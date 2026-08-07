import type { ServerDict } from "@/lib/i18n/dict/types";

export const enServer: ServerDict = {
  auth: {
    loginRequired: "Please sign in first",
    sessionExpired: "Your session expired — please sign in again",
    badPhone: "Enter an 11-digit mainland China phone number",
    accountDeleted:
      "The account for this number was deleted and cannot sign in again",
    accountSuspended:
      "This account is suspended. Contact an administrator if you think this is a mistake.",
    resendTooSoon: "Too many requests — try again in a minute",
    tooManyRequests: "Too many requests — please try again later",
    smsFailed: "Could not send the SMS, please try again later",
    badCode: "Enter the 6-digit code",
    codeExpired: "That code is invalid or expired — request a new one",
    codeWrong: "Wrong code",
    defaultNickname: "User {suffix}",
    deletedNickname: "Deleted user",
    smsUnavailableTitle: "SMS delivery is not live yet, so no message will arrive",
    smsUnavailableBody: "Contact {contact} for this sign-in's 6-digit code",
    deleteOwnedOrgs:
      "You still own “{orgs}”. Delete those groups before deleting your account.",
  },

  sms: {
    verificationCode: "Your code is {code}. It expires in 5 minutes.",
  },

  common: {
    badParams: "Invalid request",
    badTags: "Tags are malformed",
    saved: "Saved",
  },

  card: {
    emptyNickname: "Display name cannot be empty",
    nicknameTooLong: "Display name is at most {max} characters",
    badContactPhone: "Must be an 11-digit mainland China phone number",
    badVisibilityObject:
      'fieldVisibility must be an object, e.g. {"email":"orgs"}',
    badVisibilityValue: "Invalid visibility: {key} cannot be {value}",
    warnNoPlazaContact:
      "You have open plaza posts but no contact visible to signed-in users, so nobody can reach you",
    warnNoOrgContact:
      "You have open group posts but no contact visible to group members",
  },

  need: {
    badType: "Choose a type (need / offer)",
    emptyTitle: "Title cannot be empty",
    titleTooLong: "Title is at most {max} characters",
    badPreferredContact:
      "Preferred contact must be one of wechat / email / contactPhone",
    badStatus: "Status must be one of open / done / closed",
    missingExpiry: "Pick a deadline, or choose no deadline",
    expiryInPast: "The deadline must be in the future",
    badScope: "Invalid scope",
    notOrgMember: "You can only post to groups you have joined",
    noOrgContact:
      "Your card has no contact visible to group members, so nobody could reach you. Turn one on under Me → Edit card first.",
    noPlazaContact:
      "Your card has no contact visible to signed-in users, so nobody could reach you. Turn one on under Me → Edit card first.",
    preferredContactUnavailable:
      "That preferred contact is not visible within the chosen scope",
    dailyLimit: "You can post at most {max} times a day",
    notOwner: "You can only edit your own posts",
    noContactForScope:
      "No contact is available for this scope — edit your card first",
  },

  org: {
    emptyName: "Group name cannot be empty",
    nameTooLong: "Group name is at most {max} characters",
    joinLimitWithCreate:
      "You can be in at most {max} groups (groups you create count too)",
    joinLimit: "You can be in at most {max} groups",
    alreadyMember: "You are already a member of this group",
    alreadyApplied: "You already applied — an admin will review it",
    emptyCode: "Enter an invite code",
    codeTooManyAttempts: "Too many attempts — try again in an hour",
    badCode: "Invalid invite code",
    appliedTo: "Applied to “{name}” — an admin will review it",
    notFound: "Group not found",
    applied: "Applied — an admin will review it",
    requestGone: "That application no longer exists or was already handled",
    adminOnly: "Only admins can review applications",
    targetAlreadyMember: "They are already a member",
    targetJoinLimit:
      "They are already in {max} groups and cannot join another",
    promoteAdminOnly: "Only admins can appoint admins",
    selfAlreadyAdmin: "You are already an admin",
    targetNotMember: "That user is not a member of this group",
    targetAlreadyAdmin: "They are already an admin",
    adminLimit:
      "A group can have at most {max} admins (the owner is counted separately)",
    promoteFailed: "Could not appoint — refresh and try again",
    promoted: "Now an admin",
    ownerOnly: "Only the group owner can edit this",
  },

  connection: {
    messageTooLong: "The message is at most 200 characters",
    notOpen: "You cannot raise your hand on this post right now",
    blocked: "You cannot reach this user right now",
    needNotFound: "That post does not exist",
    already: "You already raised your hand",
    submitted: "Raised — waiting for the poster to respond",
  },

  report: {
    badReason: "Choose a reason",
    detailsTooLong: "Details are at most 500 characters",
    selfReport: "You cannot report yourself",
    duplicate: "You already reported this — we are looking into it",
    submitted: "Report submitted — we'll look into it shortly",
  },

  api: {
    missingKey: "Missing API Key. Send header Authorization: Bearer <Key>",
    invalidKey: "API Key is invalid or has been deleted",
    accountSuspended: "This account is suspended",
    accountDeleted: "This account was deleted",
    rateLimited:
      "Too many requests ({max} per key per minute), please try again later",
    bodyNotObject: "Request body must be a JSON object",
    orgParamNotId: "org must be a group id",
    orgNotFoundOrNotMember: "Group not found, or you are not a member",
    badStatusFilter: "status must be one of open / done / closed",
    statusOnCreate: "status cannot be set on create — new posts are open",
    userNotFound: "User not found",
    needNotFound: "Post not found",
    needNotYours: "Post not found, or it is not yours",
    scopeImmutable:
      "Scope cannot change after posting — close it and post again",
  },

  apiKey: {
    emptyName: "Give the key a name (e.g. “My Claude”)",
    nameTooLong: "Name is at most {max} characters",
    perUserLimit: "You can hold at most {max} keys — delete one first",
  },

  skill: {
    install: `# Installing the official We Match Skill (for AI agents)

You have been asked to install the official We Match Skill. We Match ({origin}) is a
supply-and-demand matching tool; with this Skill installed you can read and manage the
user's card and posts on their behalf. Follow these steps:

## 1. Download and unpack the Skill

Claude Code keeps user skills in \`~/.claude/skills/\` (other agent frameworks use their own directory):

\`\`\`bash
mkdir -p ~/.claude/skills
curl -fsSL {origin}/we-match-skill.zip -o /tmp/we-match-skill.zip
unzip -o /tmp/we-match-skill.zip -d ~/.claude/skills/
rm /tmp/we-match-skill.zip
\`\`\`

After unpacking, \`~/.claude/skills/we-match/SKILL.md\` should exist.

## 2. Configure the API Key

Ask the user to generate an API Key at {origin}/me?section=agent. They can hand the key
straight to you; write it into their shell config (for example \`~/.zshrc\`):

\`\`\`bash
export WEMATCH_API_KEY=<the user's key>
export WEMATCH_BASE_URL={origin}
\`\`\`

The key has full read and write access. Once configured, do not echo the key in later output.

## 3. Verify

\`\`\`bash
curl -s -H "Authorization: Bearer $WEMATCH_API_KEY" {origin}/api/v1/me
\`\`\`

JSON describing the user's card means the install worked (open a new terminal or source the
config first; Claude Code needs a session restart to load the new Skill). Then tell the user
they can try: "See if anyone on the We Match plaza matches what I need."
`,
  },

  notification: {
    orgJoinRequestedTitle: "{name} applied to join your group",
    orgJoinRequestedViaCode: "Applied with an invite code, awaiting review",
    orgJoinRequestedViaPlaza: "Applied from the group plaza, awaiting review",
    orgJoinApprovedTitle: "You joined “{org}”",
    orgJoinRejectedTitle: "“{org}” did not accept your application",

    connectionRequestedTitle: "{name} raised a hand on your post",
    connectionAcceptedTitle: "{name} accepted your raise",
    connectionRejectedTitle: "{name} did not accept your raise",
    connectionCancelledTitle: "{name} withdrew their raise",
    connectionAboutNeed: "About “{need}”",

    connectionCompletedTitle: "Both sides confirmed this match is done",
    connectionCompletedBody: "“{need}” became a completed connection",
    completionRequestedTitle: "{name} confirmed the match is done",
    completionRequestedBody: "Please confirm whether this match is done",

    needMatchesTitle: "Found {n} posts that might match",
    needMatchesBody: "Related by tag to your new post “{need}”",
  },
};
