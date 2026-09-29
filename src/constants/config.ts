import type { ComponentProps } from 'react';
import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ActivityCategory } from '@/types';

export type AppIconName = ComponentProps<typeof Ionicons>['name'];

export const APP_CONFIG = {
  name: 'EcoTrack',
  subtitle: 'AI-Powered Sustainability Companion',
  version: '1.0.0',
  defaultDailyBudgetKg: 12.0,
  emissionUnit: 'kg CO₂e' as const,
} as const;

export interface CategoryMeta {
  key: ActivityCategory;
  label: string;
  shortLabel: string;
  icon: AppIconName;
  activeIcon: AppIconName;
  accentColor: string;
  softBackground: string;
  description: string;
}

export const ACTIVITY_CATEGORIES: readonly CategoryMeta[] = [
  {
    key: 'transport',
    label: 'Transportation',
    shortLabel: 'Transport',
    icon: 'car-outline',
    activeIcon: 'car',
    accentColor: '#166534',
    softBackground: '#DCFCE7',
    description: 'Car rides, public transit, flights & cycling',
  },
  {
    key: 'electricity',
    label: 'Electricity',
    shortLabel: 'Electricity',
    icon: 'flash-outline',
    activeIcon: 'flash',
    accentColor: '#D97706',
    softBackground: '#FEF3C7',
    description: 'Home power usage, HVAC, appliances & solar',
  },
  {
    key: 'food',
    label: 'Food',
    shortLabel: 'Food',
    icon: 'restaurant-outline',
    activeIcon: 'restaurant',
    accentColor: '#15803D',
    softBackground: '#ECFDF5',
    description: 'Daily meals, meat swaps & local groceries',
  },
  {
    key: 'lifestyle',
    label: 'Lifestyle',
    shortLabel: 'Lifestyle',
    icon: 'bag-handle-outline',
    activeIcon: 'bag-handle',
    accentColor: '#0284C7',
    softBackground: '#E0F2FE',
    description: 'Shopping, digital habits, recycling & reusables',
  },
] as const;

export interface CalculatorPreset {
  id: string;
  category: ActivityCategory;
  label: string;
  unitLabel: string;
  defaultQuantity: number;
  factorKgPerUnit: number;
  direction: 'emission' | 'offset';
  helper: string;
}

export const CALCULATOR_PRESETS: readonly CalculatorPreset[] = [
  // Transportation
  {
    id: 'car-petrol',
    category: 'transport',
    label: 'Petrol Car Drive',
    unitLabel: 'km',
    defaultQuantity: 12,
    factorKgPerUnit: 0.1645,
    direction: 'emission',
    helper: 'UK DESNZ 2024 average solo petrol passenger vehicle',
  },
  {
    id: 'city-bus',
    category: 'transport',
    label: 'City Bus',
    unitLabel: 'km',
    defaultQuantity: 15,
    factorKgPerUnit: 0.1085,
    direction: 'emission',
    helper: 'UK DESNZ 2024 average local passenger bus',
  },
  {
    id: 'ev-ride',
    category: 'transport',
    label: 'Electric Vehicle',
    unitLabel: 'km',
    defaultQuantity: 18,
    factorKgPerUnit: 0.0801,
    direction: 'emission',
    helper: 'Battery electric car (0.18 kWh/km × IEA global grid)',
  },
  {
    id: 'bike-walk',
    category: 'transport',
    label: 'Bicycle / Walk Swap',
    unitLabel: 'km',
    defaultQuantity: 5,
    factorKgPerUnit: 0.1645,
    direction: 'offset',
    helper: 'Petrol car emissions avoided by cycling or walking',
  },
  // Electricity
  {
    id: 'grid-kwh',
    category: 'electricity',
    label: 'Home Grid Electricity',
    unitLabel: 'kWh',
    defaultQuantity: 8,
    factorKgPerUnit: 0.445,
    direction: 'emission',
    helper: 'IEA global grid baseline (configurable by region)',
  },
  {
    id: 'ac-cooling',
    category: 'electricity',
    label: 'Air Conditioning',
    unitLabel: 'hours',
    defaultQuantity: 4,
    factorKgPerUnit: 0.6675,
    direction: 'emission',
    helper: 'Typical 1.5 kW split AC draw × IEA grid factor',
  },
  {
    id: 'laundry-dryer',
    category: 'electricity',
    label: 'Washer & Dryer Cycle',
    unitLabel: 'cycles',
    defaultQuantity: 1,
    factorKgPerUnit: 1.51,
    direction: 'emission',
    helper: '3.4 kWh warm wash & electric tumble dry × IEA grid',
  },
  {
    id: 'solar-offset',
    category: 'electricity',
    label: 'Solar / Green Power',
    unitLabel: 'kWh',
    defaultQuantity: 6,
    factorKgPerUnit: 0.445,
    direction: 'offset',
    helper: 'Grid electricity offset via clean rooftop solar',
  },
  // Food
  {
    id: 'beef-meal',
    category: 'food',
    label: 'Beef / Red Meat Meal',
    unitLabel: 'meals',
    defaultQuantity: 1,
    factorKgPerUnit: 6.2,
    direction: 'emission',
    helper: 'Poore & Nemecek (2018) 100 g beef portion + sides',
  },
  {
    id: 'poultry-meal',
    category: 'food',
    label: 'Poultry or Fish Meal',
    unitLabel: 'meals',
    defaultQuantity: 1,
    factorKgPerUnit: 2.1,
    direction: 'emission',
    helper: 'Poore & Nemecek (2018) 120 g poultry/fish + sides',
  },
  {
    id: 'vegetarian-meal',
    category: 'food',
    label: 'Vegetarian Meal',
    unitLabel: 'meals',
    defaultQuantity: 1,
    factorKgPerUnit: 1.25,
    direction: 'emission',
    helper: 'Dairy/egg inclusive vegetarian meal (~500 g)',
  },
  {
    id: 'plant-based-swap',
    category: 'food',
    label: 'Plant-Based Meal',
    unitLabel: 'meals',
    defaultQuantity: 1,
    factorKgPerUnit: 0.82,
    direction: 'emission',
    helper: 'Scarborough et al. (2023) whole-plant vegan meal',
  },
  // Lifestyle
  {
    id: 'municipal-water',
    category: 'lifestyle',
    label: 'Municipal Cold Water',
    unitLabel: 'L',
    defaultQuantity: 150,
    factorKgPerUnit: 0.000339,
    direction: 'emission',
    helper: 'UK DESNZ 2024 water supply & wastewater treatment',
  },
  {
    id: 'landfill-waste',
    category: 'lifestyle',
    label: 'Household Waste (Landfill)',
    unitLabel: 'kg',
    defaultQuantity: 1,
    factorKgPerUnit: 0.497,
    direction: 'emission',
    helper: 'UK DESNZ 2024 municipal landfill waste factor',
  },
  {
    id: 'mixed-recycling',
    category: 'lifestyle',
    label: 'Mixed Dry Recycling',
    unitLabel: 'kg',
    defaultQuantity: 2,
    factorKgPerUnit: 3.12,
    direction: 'offset',
    helper: 'US EPA WARM v16 avoided virgin production & landfill credit',
  },
  {
    id: 'reusable-habit',
    category: 'lifestyle',
    label: 'Food Waste Composting',
    unitLabel: 'kg',
    defaultQuantity: 1,
    factorKgPerUnit: 0.5691,
    direction: 'offset',
    helper: 'Avoided EPA WARM landfill emissions minus composting',
  },
] as const;

export const DAILY_GREEN_TIPS: readonly {
  title: string;
  description: string;
  savingsLabel: string;
}[] = [
  {
    title: 'Wash clothes on cold',
    description:
      'Up to 80% of a washing cycle’s energy heats the water. Switching to 30°C cold water keeps colors bright and cuts power draw.',
    savingsLabel: 'Saves ~0.6 kg CO₂e / load',
  },
  {
    title: 'Swap one red-meat lunch',
    description:
      'Choosing a plant-forward bowl once or twice a week is one of the highest-impact daily changes for personal emissions.',
    savingsLabel: 'Saves ~3.8 kg CO₂e / meal',
  },
  {
    title: 'Unplug phantom standby loads',
    description:
      'Smart power strips for monitors, TVs, and chargers eliminate idle overnight electricity draw.',
    savingsLabel: 'Saves ~0.5 kg CO₂e / day',
  },
  {
    title: 'Bundle errands or take transit',
    description:
      'Combining short trips avoids cold-engine starts, where cars emit noticeably more per kilometer.',
    savingsLabel: 'Saves ~1.9 kg CO₂e / trip',
  },
];

export const AI_COACH_SUGGESTIONS: readonly string[] = [
  'How can I cut my weekly commute emissions by 20%?',
  'Suggest 3 low-carbon dinner swaps for this week',
  'Compare 15 km by city bus vs. petrol car',
  'What is the easiest way to raise my Eco Score?',
];

export interface OnboardingSlide {
  id: string;
  badge: string;
  title: string;
  description: string;
  highlights: readonly string[];
  icon: AppIconName;
  accentIcon: AppIconName;
}

export const ONBOARDING_SLIDES: readonly OnboardingSlide[] = [
  {
    id: 'tracking',
    badge: '01 • Smart Tracking',
    title: 'Understand your daily carbon footprint',
    description:
      'Log everyday travel, home electricity, meals, and lifestyle choices in seconds with transparent kg CO₂e estimates.',
    highlights: [
      'Real-time daily & weekly CO₂e breakdown',
      'Instant emission & offset calculator',
      'Track against your personal daily budget',
    ],
    icon: 'leaf',
    accentIcon: 'analytics',
  },
  {
    id: 'challenges',
    badge: '02 • Habit Streaks',
    title: 'Turn green habits into daily challenges',
    description:
      'Build lasting momentum with achievable daily challenges, eco streaks, and milestone badges that reward progress.',
    highlights: [
      'Curated daily & weekly green challenges',
      'Visual streak and progress trackers',
      'Unlock sustainability badges & eco points',
    ],
    icon: 'trophy',
    accentIcon: 'flame',
  },
  {
    id: 'ai',
    badge: '03 • Gemini AI',
    title: 'Personalized AI sustainability coaching',
    description:
      'Ask EcoTrack’s AI Assistant anything—get tailored swaps, footprint comparisons, and weekly action plans.',
    highlights: [
      'Context-aware reduction recommendations',
      'Instant carbon comparisons & meal swaps',
      'Actionable guidance without the guesswork',
    ],
    icon: 'sparkles',
    accentIcon: 'chatbubbles',
  },
];
