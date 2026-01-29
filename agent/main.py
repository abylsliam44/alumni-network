"""
AI Video Call Agent для Alumni Social Network.

Этот агент автоматически подключается к видеозвонкам как скрытый участник,
транскрибирует разговор через Deepgram и генерирует саммари через GPT-4o.
Результат сохраняется как системное сообщение в чате.
"""

import asyncio
import logging
import os
from datetime import datetime
from typing import Optional

import httpx
from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import (
    AutoSubscribe,
    JobContext,
    JobProcess,
    WorkerOptions,
    cli,
    llm,
)
from livekit.agents.stt import SpeechEvent, SpeechEventType
from livekit.plugins import deepgram, openai

load_dotenv(override=False)  # Не переопределяем переменные из Docker environment

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("videocall-agent")

# URL бэкенда для сохранения результатов
BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:8000")
BACKEND_API_SECRET = os.getenv("BACKEND_API_SECRET", "")

# Debug: проверяем что переменные окружения загружены
_lk_url = os.getenv("LIVEKIT_URL", "")
_lk_key = os.getenv("LIVEKIT_API_KEY", "")
_lk_secret = os.getenv("LIVEKIT_API_SECRET", "")
logger.info(f"=== AGENT STARTUP ===")
logger.info(f"LIVEKIT_URL: {'SET' if _lk_url else 'NOT SET'} ({_lk_url[:30]}...)" if _lk_url else "LIVEKIT_URL: NOT SET")
logger.info(f"LIVEKIT_API_KEY: {'SET' if _lk_key else 'NOT SET'}")
logger.info(f"LIVEKIT_API_SECRET: {'SET' if _lk_secret else 'NOT SET'}")
logger.info(f"BACKEND_URL: {BACKEND_URL}")


class TranscriptBuffer:
    """Буфер для накопления транскриптов во время звонка."""

    def __init__(self):
        self.entries: list[dict] = []
        self.start_time: Optional[datetime] = None

    def add_entry(self, speaker_identity: str, text: str, timestamp: datetime):
        if self.start_time is None:
            self.start_time = timestamp
        self.entries.append({
            "speaker": speaker_identity,
            "text": text,
            "timestamp": timestamp.isoformat(),
        })

    def get_formatted_transcript(self) -> str:
        """Форматирует транскрипт как диалог."""
        if not self.entries:
            return ""
        lines = []
        for entry in self.entries:
            lines.append(f"[{entry['speaker']}]: {entry['text']}")
        return "\n".join(lines)

    def clear(self):
        self.entries = []
        self.start_time = None


async def generate_summary(transcript: str) -> str:
    """Генерирует саммари звонка через GPT-4o."""
    if not transcript.strip():
        return "Звонок завершён. Разговор не был записан."

    client = openai.LLM(model="gpt-4o")
    
    prompt = f"""Ты ассистент, который анализирует транскрипт видеозвонка между пользователями платформы Alumni Social Network.

Проанализируй следующий транскрипт и создай структурированное резюме на русском языке в формате Markdown:

## 📝 Краткое резюме
[2-3 предложения о сути разговора]

## 🎯 Ключевые моменты
- [Пункт 1]
- [Пункт 2]
- ...

## ✅ Действия и договорённости
- [Если есть договорённости о действиях, перечислить их]
- [Если нет - написать "Конкретных договорённостей не обсуждалось"]

## 💡 Инсайты
- [Важные выводы или идеи из разговора]

---
Транскрипт:
{transcript}
"""

    messages = [llm.ChatMessage(role="user", content=prompt)]
    
    response = ""
    async for chunk in client.chat(chat_ctx=llm.ChatContext().append(role="user", text=prompt)):
        if chunk.choices and chunk.choices[0].delta.content:
            response += chunk.choices[0].delta.content
    
    return response


async def save_summary_to_backend(
    conversation_id: str,
    room_name: str,
    transcript: str,
    summary: str,
    duration_seconds: int,
):
    """Отправляет саммари на бэкенд для сохранения в чате."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{BACKEND_URL}/api/v1/videocall/save-summary",
                json={
                    "conversation_id": conversation_id,
                    "room_name": room_name,
                    "transcript": transcript,
                    "summary": summary,
                    "duration_seconds": duration_seconds,
                },
                headers={
                    "X-Agent-Secret": BACKEND_API_SECRET,
                    "Content-Type": "application/json",
                },
                timeout=30.0,
            )
            if response.status_code == 200:
                logger.info(f"Саммари успешно сохранен для conversation_id={conversation_id}")
            else:
                logger.error(f"Ошибка сохранения саммари: {response.status_code} - {response.text}")
    except Exception as e:
        logger.error(f"Ошибка при отправке саммари на бэкенд: {e}")


async def entrypoint(ctx: JobContext):
    """
    Главная точка входа для агента.
    Вызывается когда агент присоединяется к комнате.
    """
    logger.info(f"Агент подключается к комнате: {ctx.room.name}")
    
    # Извлекаем conversation_id из имени комнаты: call_{conversation_id}_{timestamp}
    room_name = ctx.room.name
    conversation_id = ""
    try:
        parts = room_name.split("_")
        if len(parts) >= 3 and parts[0] == "call":
            # UUID находится между первым "call_" и последним "_timestamp"
            # Формат: call_{uuid}_{timestamp}
            conversation_id = parts[1]
            logger.info(f"Извлечён conversation_id: {conversation_id}")
        else:
            logger.warning(f"Неожиданный формат имени комнаты: {room_name}")
    except Exception as e:
        logger.error(f"Ошибка при извлечении conversation_id: {e}")

    # Инициализируем буфер транскриптов
    transcript_buffer = TranscriptBuffer()
    
    # Настройка STT (Speech-to-Text) через Deepgram
    stt = deepgram.STT(
        model="nova-2",
        language="ru",
        punctuate=True,
        smart_format=True,
    )
    
    # Словарь для трекинга транскрипции каждого участника
    participant_streams: dict[str, asyncio.Task] = {}
    
    async def process_audio_track(participant: rtc.RemoteParticipant, track: rtc.Track):
        """Обрабатывает аудио трек участника."""
        logger.info(f"Начинаем транскрипцию для: {participant.identity}")
        
        audio_stream = rtc.AudioStream(track)
        stt_stream = stt.stream()
        
        async def forward_audio():
            async for event in audio_stream:
                stt_stream.push_frame(event.frame)
        
        async def process_stt():
            async for event in stt_stream:
                if event.type == SpeechEventType.FINAL_TRANSCRIPT:
                    text = event.alternatives[0].text if event.alternatives else ""
                    if text.strip():
                        transcript_buffer.add_entry(
                            speaker_identity=participant.identity,
                            text=text,
                            timestamp=datetime.utcnow(),
                        )
                        logger.debug(f"[{participant.identity}]: {text}")
        
        await asyncio.gather(forward_audio(), process_stt())
    
    @ctx.room.on("track_subscribed")
    def on_track_subscribed(
        track: rtc.Track,
        publication: rtc.RemoteTrackPublication,
        participant: rtc.RemoteParticipant,
    ):
        """Вызывается когда агент подписывается на трек участника."""
        if track.kind == rtc.TrackKind.KIND_AUDIO:
            if participant.identity not in participant_streams:
                task = asyncio.create_task(process_audio_track(participant, track))
                participant_streams[participant.identity] = task
                logger.info(f"Подписались на аудио трек: {participant.identity}")
    
    @ctx.room.on("track_unsubscribed")
    def on_track_unsubscribed(
        track: rtc.Track,
        publication: rtc.RemoteTrackPublication,
        participant: rtc.RemoteParticipant,
    ):
        """Вызывается когда трек участника отключается."""
        if participant.identity in participant_streams:
            participant_streams[participant.identity].cancel()
            del participant_streams[participant.identity]
            logger.info(f"Отписались от аудио трека: {participant.identity}")
    
    # Создаём событие для отслеживания отключения
    disconnected_event = asyncio.Event()

    @ctx.room.on("disconnected")
    def on_disconnected():
        logger.info("Комната отключена")
        disconnected_event.set()

    # Подключаемся к комнате
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    logger.info("Агент успешно подключен к комнате и ожидает участников")

    # Ожидаем завершения звонка (комната закрывается)
    call_start_time = datetime.utcnow()

    try:
        # Ждем отключения от комнаты
        await disconnected_event.wait()
    except asyncio.CancelledError:
        pass
    finally:
        # Звонок завершен - генерируем саммари
        call_end_time = datetime.utcnow()
        duration_seconds = int((call_end_time - call_start_time).total_seconds())
        
        logger.info(f"Звонок завершен. Длительность: {duration_seconds} секунд")
        
        # Отменяем все активные транскрипции
        for task in participant_streams.values():
            task.cancel()
        
        # Получаем форматированный транскрипт
        transcript = transcript_buffer.get_formatted_transcript()
        
        if transcript:
            logger.info("Генерируем саммари звонка...")
            summary = await generate_summary(transcript)
            logger.info("Саммари сгенерирован")
            
            # Сохраняем на бэкенд
            if conversation_id:
                await save_summary_to_backend(
                    conversation_id=conversation_id,
                    room_name=ctx.room.name,
                    transcript=transcript,
                    summary=summary,
                    duration_seconds=duration_seconds,
                )
        else:
            logger.info("Транскрипт пустой, саммари не генерируется")


def prewarm(proc: JobProcess):
    """Предварительная загрузка моделей и ресурсов."""
    proc.userdata["stt"] = deepgram.STT(
        model="nova-2",
        language="ru",
    )


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
        )
    )
