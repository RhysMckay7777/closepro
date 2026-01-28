export interface TourStep {
  id: string;
  targetSelector: string;
  title: string;
  description: string;
}

export const DASHBOARD_TOUR_STEPS: TourStep[] = [
  {
    id: 'greeting',
    targetSelector: '[data-tour="dashboard-greeting"]',
    title: 'Welcome to ClosePro',
    description: "Here's your performance at a glance. Your calls and roleplays feed into these numbers.",
  },
  {
    id: 'nav-offers',
    targetSelector: '[data-tour="nav-offers"]',
    title: 'Offers',
    description: 'Define what you sell and who you sell to. Each offer can have multiple prospect profiles for roleplay.',
  },
  {
    id: 'nav-roleplay',
    targetSelector: '[data-tour="nav-roleplay"]',
    title: 'AI Roleplay',
    description: 'Practice with AI prospects tied to an offer. Pick an offer, pick a prospect, then start a call.',
  },
  {
    id: 'nav-calls',
    targetSelector: '[data-tour="nav-calls"]',
    title: 'Calls',
    description: 'Upload real call recordings to get AI feedback and scores.',
  },
];
