Critical: Strip ALL overrides from useConversation. Test bare connection first.

In hooks/use-voice-session.ts:

Remove the entire overrides block from useConversation(). Make it:

typescript
const conversation = useConversation({
  onConnect: () => { ... },
  onDisconnect: () => { ... },
  onMessage: (msg) => { ... },
  onError: (err) => { ... },
  onStatusChange: (status) => { ... },
});
No overrides at all.

startSession stays as just { signedUrl } — no overrides there either.

The signed URL already encodes the agent ID. The agent has a default system prompt and first message configured on the ElevenLabs dashboard ("Okay, um, so what's this about then?"). So a bare connection WILL work — the prospect will use the dashboard defaults.

This is a diagnostic step. If the connection stays alive with zero overrides, we know:

The agent config is correct ✅

The signed URL works ✅

The problem is purely in how we format overrides

Deploy this and test. If the connection holds, send me the result and I'll write the proper override injection using sendContextualUpdate() instead (which lets you send the system prompt AFTER connecting, avoiding the init-time problem entirely)