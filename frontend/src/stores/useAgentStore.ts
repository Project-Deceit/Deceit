import { create } from "zustand";
export interface AgentData {
  id: string;
  username: string;
  description: string;
  vote: string;
}

export const useAgentDataStore = create<{
  agent: AgentData[];
  setAgent: (agent: AgentData[]) => void;
}>((set) => ({
  agent: [],
  setAgent: (agent) => set({ agent }),
}));
