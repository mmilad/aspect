export const REGISTERED_AGENT_CAPABILITIES = [
  "project.list_agents",
  "project.get_entity"
] as const;

export const DIRECT_AGENT_CAPABILITIES =
  "Direct Agent Runtime has no arbitrary tools. It can execute only explicitly assigned workflows and registered capabilities. " +
  "Profile expertise is descriptive and does not grant runtime access. Unknown capability names are unavailable.";
