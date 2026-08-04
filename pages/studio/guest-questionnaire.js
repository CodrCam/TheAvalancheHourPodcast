import Head from 'next/head';
import GuestQuestionnaireForm from '../../components/GuestQuestionnaireForm';

export default function StudioGuestQuestionnairePage() {
  return (
    <>
      <Head>
        <title>Guest Questionnaire | The Avalanche Hour</title>
        <meta name="robots" content="noindex,nofollow,noarchive" />
        <meta name="referrer" content="no-referrer" />
        <meta
          name="description"
          content="Private episode preparation questionnaire for a guest of The Avalanche Hour."
        />
      </Head>
      <GuestQuestionnaireForm />
    </>
  );
}
