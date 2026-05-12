import Pill from '../ui/Pill';

const SkillsMatchBadge = ({ score = 0 }) => {
  const tone = score >= 70 ? 'ok' : score >= 40 ? 'warm' : score > 0 ? 'blue' : undefined;
  return <Pill tone={tone} dot={score > 0}>{score}% match</Pill>;
};

export default SkillsMatchBadge;
