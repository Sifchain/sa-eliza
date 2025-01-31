import type { Plugin } from "@elizaos/core";
import { postAction } from "./actions/post";

export const twitterPlugin: Plugin = {
    name: "twitter",
    description: "Twitter integration plugin for posting tweets",
    actions: [postAction],
    evaluators: [],
    providers: [],
};

export { postTweet } from "./actions/post";
export default twitterPlugin;
