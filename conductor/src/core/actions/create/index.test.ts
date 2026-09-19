import { describe, expect, it } from "@rstest/core";
import { discordInterventionRoute } from "./index.js";

const base = {
  channel: "discord",
  connectionId: "discord-connection",
  threadId: "conversation-1",
  channelUserId: "guardian-1",
  senderBondLevel: "guardian",
} as const;

describe("Discord intervention origin capture", () => {
  it("captures a guardian DM as the default private return route", () => {
    expect(discordInterventionRoute({ ...base, threadType: "private" }, false)).toEqual({
      channel: "discord",
      connectionId: "discord-connection",
      threadId: "conversation-1",
      channelUserId: "guardian-1",
      visibility: "guardian-dm",
    });
  });

  it("requires explicit consent for an existing native shared thread", () => {
    const thread = { ...base, threadType: "group" as const, parentThreadId: "parent-channel" };
    expect(discordInterventionRoute(thread, false)).toBeUndefined();
    expect(discordInterventionRoute(thread, true)).toEqual({
      channel: "discord",
      connectionId: "discord-connection",
      threadId: "conversation-1",
      parentThreadId: "parent-channel",
      channelUserId: "guardian-1",
      visibility: "guardian-authorized-thread",
    });
  });

  it("rejects ordinary channels, non-guardians, non-Discord origins, and incomplete routes", () => {
    expect(discordInterventionRoute({ ...base, threadType: "group" }, true)).toBeUndefined();
    expect(discordInterventionRoute({ ...base, threadType: "private", senderBondLevel: "inner-circle" }, false)).toBeUndefined();
    expect(discordInterventionRoute({ ...base, channel: "webchat", threadType: "private" }, false)).toBeUndefined();
    expect(discordInterventionRoute({ ...base, connectionId: "", threadType: "private" }, false)).toBeUndefined();
  });
});
