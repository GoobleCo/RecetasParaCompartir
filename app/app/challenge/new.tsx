import { router } from 'expo-router';
import { ChallengeForm } from '../../components/ChallengeForm';
import { createChallenge } from '../../lib/api';

export default function NewChallenge() {
  return (
    <ChallengeForm
      submitLabel="Publicar desafío"
      onSubmit={async (input) => {
        const id = await createChallenge(input);
        router.replace(`/challenge/${id}`);
      }}
    />
  );
}
