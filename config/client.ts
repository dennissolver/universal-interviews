// config/client.ts
export const clientConfig = {
  platform: {
    name: "Universal Interviews",
    tagline: "AI-Powered Interview Platform",
    description: "Conduct structured interviews with AI assistance.",
    version: "1.0.0",
  },
  company: {
    name: "Universal Interviews",
    website: "",
    supportEmail: "support@example.com",
  },
  theme: {
    mode: "dark" as "dark" | "light",
    colors: {
      primary: "#8B5CF6",
      accent: "#10B981",
      background: "#0F172A",
    },
  },
  features: {
    enableAnalytics: true,
    enableExport: true,
  },
  parent: {
    apiUrl: "http://localhost:3000",
  },
} as const;

export const getPlatformInfo = () => clientConfig.platform;
export const getCompanyInfo = () => clientConfig.company;
export type ClientConfig = typeof clientConfig;