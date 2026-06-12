export type Suggestion = {
  id: string;
  title: string;
  question: string;
  icon: "visibility" | "availability" | "pricing" | "portfolio";
};

export const suggestions: Suggestion[] = [
  {
    id: "visibility",
    title: "Visibility",
    question: "Why is HP losing visibility in Singapore?",
    icon: "visibility",
  },
  {
    id: "availability",
    title: "Availability",
    question: "Which retailers have stock issues?",
    icon: "availability",
  },
  {
    id: "pricing",
    title: "Pricing",
    question: "Which SKUs are overpriced vs competitors?",
    icon: "pricing",
  },
  {
    id: "portfolio",
    title: "Portfolio",
    question: "What products are underperforming?",
    icon: "portfolio",
  },
];
