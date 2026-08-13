import type { ServerDict } from "@/lib/i18n/dict/types";

export const enServer: ServerDict = {
  auth: {
    loginRequired: "Please sign in first",
    sessionExpired: "Your session expired — please sign in again",
    badEmail: "Enter a valid email address",
    accountDeleted:
      "The account for this address was deleted and cannot sign in again",
    accountSuspended:
      "This account is suspended. Contact an administrator if you think this is a mistake.",
    resendTooSoon: "Too many requests — try again in a minute",
    tooManyRequests: "Too many requests — please try again later",
    mailFailed: "Could not send the email, please try again later",
    badCode: "Enter the 6-digit code",
    codeExpired: "That code is invalid or expired — request a new one",
    codeWrong: "Wrong code",
    defaultNickname: "User {suffix}",
    deletedNickname: "Deleted user",
    mailUnavailableTitle:
      "Email delivery is not live yet, so no message will arrive",
    mailUnavailableBody: "Contact {contact} for this sign-in's 6-digit code",
    deleteOwnedOrgs:
      "You still own “{orgs}”. Delete those groups before deleting your account.",
  },

  mail: {
    verificationSubject: "Your We Match code is {code}",
    verificationText: `Your code is {code}. It expires in 5 minutes.

This email is for signing in to or registering with We Match. If you asked an AI
agent to register for you, hand it this code.

If you did not request this, ignore this email — and never pass the code on to
anyone who asks you for it.`,

    keyIssuedSubject: "A new We Match API key was issued",
    keyIssuedText: `Your We Match account just issued an API key through the agent
registration endpoint: “{name}”.

This key has full read and write access to your account — it can post needs and
edit your card on your behalf.

If this wasn't you, delete it right away at {origin}/me?section=agent`,
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
      "You have open plaza posts but no contact that can be exchanged, so a raised hand would have nothing to give",
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
      "Your card has no contact that can be exchanged (visible after a connection, or to signed-in users). Add one under Me → Edit card first.",
    preferredContactUnavailable:
      "That preferred contact is not visible within the chosen scope",
    dailyLimit: "You can post at most {max} times a day",
    notOwner: "You can only edit your own posts",
    noContactForScope:
      "No contact is available for this scope — edit your card first",
    staleHandsBlockRenewal:
      "Raised hands have been waiting on you for over 3 days. Respond to them under Me → Quota before renewing or reopening this post.",
    idempotencyConflict:
      "This Idempotency-Key was already used for a different post — use a new key for a new post",
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
    missingContact: "Pick a contact to exchange",
    contactUnavailable: "That contact is not available — add it on your card first",
    rejectCooldown: "They did not accept. You can raise again in 7 days",
    resendLimit: "You cannot raise on this post again",
  },

  quota: {
    tooFast: "Too fast — try again in a moment",
    publishDaily: "Today's {max} posts are used up. Resets at midnight",
    publishDailyNewbie:
      "New accounts can post {max} times a day. Fill in intro, a tag, and one contact to raise it to {full}",
    publishStock: "You already have {max} open posts — close some before posting again",
    publishBacklog:
      "{n} raised hands are waiting on you. Respond under Me → Quota before posting again",
    pendingStock:
      "You have {max} raises waiting. Withdraw one, or wait for a reply, before raising again",
    acceptedStock:
      "You already have {max} unfinished connections — confirm or withdraw one first",
    raiseDaily: "You already raised {max} times today. Resets at midnight",
    acceptDaily: "You already accepted {max} raises today. Resets at midnight",
    needAcceptCap:
      "This post already connected 10 people. Post a new one if you still need more",
    sameUserDaily: "You already reached out to them today — try again tomorrow",
    revealDaily:
      "You have given out contact details {max} times today. Resets at midnight",
    penaltyPublish:
      "Your posting quota is temporarily reduced while we take a look. It restores on its own",
    penaltyRaise:
      "Your raise quota is temporarily reduced. It restores on its own after a while",
    penaltyAccept:
      "Your accept quota is temporarily reduced while we take a look. It restores on its own",
    needClosedToRaises:
      "This post has received a lot of raises and is not taking new ones for now",
    reportDaily: "You already filed {max} reports today. Resets at midnight",
    reportCooldown:
      "This report was just handled — you can report again in 7 days",
    blockDaily: "You already blocked {max} people today. Resets at midnight",
    orgCreateDaily: "You already created {max} groups today. Resets at midnight",
    orgJoinDaily:
      "You already sent {max} join requests today. Resets at midnight",
    orgJoinStock:
      "You have {max} group applications awaiting review — wait for an admin first",
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
    authRateLimited:
      "Too many sign-up requests ({max} per hour per IP) — try again later",
    rateLimited:
      "Too many requests ({max} per key per minute), please try again later",
    bodyNotObject: "Request body must be a JSON object",
    unknownFields: "Request contains unsupported fields: {fields}",
    orgParamNotId: "org must be a group id",
    orgNotFoundOrNotMember: "Group not found, or you are not a member",
    badStatusFilter: "status must be one of open / done / closed",
    statusOnCreate: "status cannot be set on create — new posts are open",
    userNotFound: "User not found",
    needNotFound: "Post not found",
    needNotYours: "Post not found, or it is not yours",
    scopeImmutable:
      "Scope cannot change after posting — close it and post again",
    badSince: "since must be an ISO 8601 timestamp",
    badCursor: "cursor is invalid or expired — remove it and try again",
    badIdempotencyKey:
      "Idempotency-Key may contain letters, numbers, dots, underscores, colons, or hyphens and must be at most 128 characters",
  },

  apiKey: {
    emptyName: "Give the key a name (e.g. “My Claude”)",
    nameTooLong: "Name is at most {max} characters",
    perUserLimit: "You can hold at most {max} keys — delete one first",
    agentDefaultName: "My agent",
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

## 2. Get an API key

**If the user already has an account**: ask them to copy a key from {origin}/me?section=agent.

**If they don't**: they never need to open the site — ask for an email address and do it yourself:

\`\`\`bash
# Step one: send a code to that address
curl -s -X POST {origin}/api/v1/auth/code \\
  -H "Content-Type: application/json" -d '{"email":"<the user's email>"}'

# Step two: ask the user for the 6-digit code, trade it for a key
curl -s -X POST {origin}/api/v1/auth/token \\
  -H "Content-Type: application/json" \\
  -d '{"email":"<the user's email>","code":"<the code>","name":"My Claude"}'
\`\`\`

The \`key\` in the response is the credential; \`isNew: true\` means the account was just created.
Only ask for a verification code inside a registration the user started. Use it and discard it.

## 3. Store the credential safely

Prefer the agent platform's Secret or Credential Store. If none exists, use a dedicated user-only file; never put the key in a project directory or append it directly to the global \`~/.zshrc\`:

\`\`\`bash
install -d -m 700 ~/.config/we-match
umask 077
touch ~/.config/we-match/env
chmod 600 ~/.config/we-match/env
export WEMATCH_API_KEY=<the user's key>
export WEMATCH_BASE_URL={origin}
\`\`\`

Write the two \`export\` lines above to \`~/.config/we-match/env\` and load it only before running the We Match agent. The key has full read and write access. Do not echo it in later output, command logs, or error reports.

## 4. Verify

\`\`\`bash
curl -s -H "Authorization: Bearer $WEMATCH_API_KEY" {origin}/api/v1/me
\`\`\`

JSON describing the user's card means the install worked (open a new terminal or source the
config first; Claude Code needs a session restart to load the new Skill).

A freshly registered account has an empty card — build one with the "first card" workflow in
the Skill. Existing users can go straight to: "See if anyone on the We Match plaza matches
what I need."
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
