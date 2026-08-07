import type { LegalDict } from "@/lib/i18n/dict/types";

// 注意：这是中文版的对照翻译，不是独立起草的英文法律文本。
// 中文版为准据文本；英文版上线前建议让运营者或律师过一遍，
// 尤其是第 7 条免责、第 9 条法律适用，以及隐私政策里跨境存储的表述。

export const enLegal: LegalDict = {
  updatedAt: "2026-08-07",

  terms: {
    metaTitle: "Terms of Service",
    heading: "Terms of Service",
    introPrefix:
      "Updated {date}. These Terms are entered into between you and {operator}, the operator of {brand} (“we”, “us”). By registering or using the service you confirm that you have read and agree to these Terms and to the ",
    introLink: "Privacy Policy",
    introSuffix: ".",

    s1Title: "1. What the service is",
    s1aPrefix:
      "{brand} is a tool for showing supply and demand: you keep a card, post “I need / I offer” to the public plaza or to a group you belong to, and contact people yourself through the channels they have chosen to share. We only display and index information. We ",
    s1aStrong: "do not take part in, guarantee, or mediate",
    s1aSuffix: " any communication, collaboration or transaction between users.",

    s2Title: "2. Accounts",
    s2a: "The service uses a phone number and an SMS code to register and sign in. You must use a number you hold yourself and keep your device and codes secure; anything done through your account is treated as done by you. You must have the legal capacity appropriate to your use of the service; minors should use it with the consent and guidance of a guardian.",

    s3Title: "3. Content and conduct",
    s3a: "You are responsible for the card, posts, group information and other content you publish, and you warrant that it is truthful, lawful and does not infringe anyone's rights. Content prohibited by law is not allowed, nor is harassment, fraud, impersonation, bulk advertising or spam, nor unauthorised scraping, crawling or resale of platform data.",
    s3b: "So that we can show your content to other users, you grant us a licence to store and display what you publish within the scope of this service; the licence ends when you delete the content or delete your account.",

    s4Title: "4. Moderation",
    s4a: "Any user can report content or another user. We may take down content and suspend or terminate accounts that breach these Terms or the law.",

    s5Title: "5. Meeting offline, and your own risk",
    s5a: "Contact details, identities and claimed abilities are filled in by users themselves, and we make no warranty as to their truth or accuracy. Verify who you are dealing with before you meet, collaborate or transact offline; disputes and losses arising from that are borne by the users involved.",

    s6Title: "6. Open API and agent access",
    s6a: "You can generate an API Key that lets a program read and write data as you. An API Key is equivalent to your sign-in credential: keep it safe and revoke it promptly if it leaks. Actions taken through the API are equally subject to these Terms. We may rate-limit API calls.",

    s7Title: "7. Disclaimer and limitation of liability",
    s7a: "The service is provided “as is”. To the extent permitted by law we do not warrant that it will be uninterrupted or error-free, and we are not liable for indirect losses arising from your use of it.",

    s8Title: "8. Changes and termination",
    s8a: "We may revise these Terms; revisions are published on this page with the date updated, and significant changes are announced prominently in the app. You may stop using the service at any time, or delete your account yourself under Me → Settings → Delete account. Deletion cannot be undone, and the phone number can never sign in again.",

    s9Title: "9. Governing law",
    s9a: "These Terms are made and interpreted under the law of the operator's jurisdiction. Disputes should first be settled amicably; failing that, they are submitted to a competent court in the operator's jurisdiction.",

    s10Title: "10. Contact us",
    s10a: "Operator: {operator}. Contact: {contact}.",
  },

  privacy: {
    metaTitle: "Privacy Policy",
    heading: "Privacy Policy",
    introPrefix:
      "Updated {date}. This policy explains how {operator}, the operator of {brand} (“we”, “us”), collects, uses and protects your personal information. Together with the ",
    introLink: "Terms of Service",
    introSuffix: " it forms the basis of your use of the service.",

    s1Title: "1. What we collect",
    s1Items: [
      {
        term: "Phone number",
        desc: ": required to register and sign in, used for identity verification.",
      },
      {
        term: "Card details",
        desc: ": the display name, intro, tags, contact channels and social accounts you choose to fill in.",
      },
      {
        term: "What you post",
        desc: ": posts (I need / I offer), group information and so on.",
      },
      {
        term: "Logs",
        desc: ": the IP address and time of sign-ins and key actions, used for security and rate limiting.",
      },
    ],

    s2Title: "2. How we use it",
    s2a: "Only for: authentication and keeping you signed in; showing your card and posts to other users according to the visibility you set; and security controls that prevent abuse. We do not profile you for marketing and we do not send you advertising.",

    s3Title: "3. You control who sees what",
    s3a: "Each contact and social field on your card can be set to “signed-in users / shared groups / hidden”. Note that “signed-in users” means any registered user can see that field; signed-out visitors and search engines never receive the raw contact values.",

    s4Title: "4. Sharing with others",
    s4a: "We do not sell your personal information. We disclose it only in these cases: giving your phone number to the SMS provider so a code can be sent (used for that alone); and where law or a competent authority lawfully requires it.",

    s5Title: "5. Cookies and storage",
    s5a: "We use only the cookies needed to keep you signed in and to remember your interface language (the sign-in cookie is httpOnly, signed against tampering, and valid for 30 days). We use no third-party analytics or advertising cookies. Your data is stored on cloud servers outside mainland China and is transmitted over HTTPS.",

    s6Title: "6. Your rights",
    s6a: "You can view, correct or clear your details at any time under Me → Card, close or delete your own posts, and revoke API Keys. You can also permanently delete your account under Me → Settings → Delete account: your card details are erased, your posts are closed and all API Keys stop working. The phone number is retained solely to ensure it can never sign in again (deletion cannot be undone), and information we are legally required to keep is retained accordingly. To exercise any other rights you have by law, contact us using the details below.",

    s7Title: "7. Minors",
    s7a: "The service is intended for users with the relevant legal capacity. If we find that we have collected a minor's personal information without a guardian's consent, we will delete it as soon as we can.",

    s8Title: "8. Updates",
    s8a: "This policy may be revised as the product changes; revisions are published on this page with the date updated, and significant changes are announced prominently in the app.",

    s9Title: "9. Contact us",
    s9a: "Operator: {operator}. Contact: {contact}.",
  },
};
