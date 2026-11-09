import asyncio
from app.academic.db import create_indexes, client

async def main():
    await create_indexes()
    client.close()

asyncio.run(main())
