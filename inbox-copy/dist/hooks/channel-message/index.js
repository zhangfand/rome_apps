import { createAppLogger } from "@rome-os/app-runtime";
const log = createAppLogger("channel-message-hook");
class ChannelMessageHook {
    actionEngine;
    channelAdapters;
    constructor(actionEngine, channelAdapters){
        this.actionEngine = actionEngine;
        this.channelAdapters = channelAdapters;
    }
    register() {
        for (const [, adapter] of this.channelAdapters)this.registerAdapter(adapter);
    }
    registerAdapter(adapter) {
        adapter.onMessage(async (msg)=>{
            if (!msg.text?.trim() && 0 === msg.attachments.length) return void log.debug("skipping empty message", {
                channel: msg.channel,
                messageId: msg.id
            });
            let attachments = msg.attachments;
            if (attachments.length > 0 && "function" == typeof adapter.saveIncomingAttachments) try {
                attachments = await adapter.saveIncomingAttachments(msg);
            } catch (err) {
                log.error("failed to save incoming attachments", {
                    channel: msg.channel,
                    messageId: msg.id,
                    error: err instanceof Error ? err.message : String(err)
                });
            }
            let typingInterval;
            if ("function" == typeof adapter.notifyTyping) {
                adapter.notifyTyping(msg.threadId).catch(()=>{});
                typingInterval = setInterval(()=>{
                    adapter.notifyTyping(msg.threadId).catch(()=>{});
                }, 9000);
            }
            try {
                await this.actionEngine.run("message_handler", {
                    channel: msg.channel,
                    channelUserId: msg.channelUserId,
                    threadName: msg.threadName,
                    threadType: msg.threadType,
                    threadId: msg.threadId,
                    displayName: msg.displayName,
                    text: msg.text,
                    timestamp: msg.timestamp.toISOString(),
                    attachments,
                    messageId: msg.id,
                    replyToMessageId: msg.replyToMessageId,
                    routedAgentName: msg.routing?.agentName
                }, {
                    initiator: `channel:${msg.channel}`,
                    channelContext: {
                        channel: msg.channel,
                        threadId: msg.threadId,
                        channelUserId: msg.channelUserId,
                        threadName: msg.threadName,
                        threadType: msg.threadType
                    }
                });
            } catch (err) {
                log.error("message_handler action failed", {
                    channel: msg.channel,
                    messageId: msg.id,
                    channelUserId: msg.channelUserId,
                    error: err instanceof Error ? err.message : String(err)
                });
            } finally{
                if (void 0 !== typingInterval) clearInterval(typingInterval);
            }
        });
    }
}
function createHook(deps) {
    return new ChannelMessageHook(deps.actionEngine, deps.channelAdapters);
}
export { ChannelMessageHook, createHook };

//# sourceMappingURL=index.js.map