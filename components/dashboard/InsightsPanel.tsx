'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CORE_PRINCIPLES } from '@/lib/training/core-principles';

export interface SkillCategoryData {
  category: string;
  averageScore: number;
  trend?: number;
  strengths?: string[];
  weaknesses?: string[];
  actionPoints?: string[];
}

export interface InsightsPanelProps {
  skillCategories: SkillCategoryData[];
  totalCalls: number;
  totalRoleplays: number;
}

interface DetectedPattern {
  issue: string;
  frequency: number;
  totalSessions: number;
  cluster: string;
  severity: 'high' | 'medium' | 'low';
}

const PRINCIPLE_COLORS: Record<string, string> = {
  'Authority': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Structure': 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  'Communication & Listening': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'Gap Creation': 'bg-green-500/20 text-green-400 border-green-500/30',
  'Value Positioning': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'Trust Building': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'Adaptability': 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  'Objection Strategy': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  'Decision Leadership': 'bg-teal-500/20 text-teal-400 border-teal-500/30',
};

function getCategoryPrinciple(categoryName: string): string {
  const lower = categoryName.toLowerCase();
  for (const principle of CORE_PRINCIPLES) {
    for (const catId of principle.relatedCategories) {
      if (lower.includes(catId.replace(/_/g, ' ')) || lower === catId.replace(/_/g, ' ')) {
        return principle.name;
      }
    }
  }
  // Fallback: keyword matching
  if (lower.includes('authority')) return 'Authority';
  if (lower.includes('structure')) return 'Structure';
  if (lower.includes('communication')) return 'Communication & Listening';
  if (lower.includes('discovery') || lower.includes('gap')) return 'Gap Creation';
  if (lower.includes('value')) return 'Value Positioning';
  if (lower.includes('trust')) return 'Trust Building';
  if (lower.includes('adaptation')) return 'Adaptability';
  if (lower.includes('objection')) return 'Objection Strategy';
  if (lower.includes('closing') || lower.includes('close')) return 'Decision Leadership';
  return 'General';
}

function detectPatterns(skillCategories: SkillCategoryData[], totalSessions: number): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];

  for (const skill of skillCategories) {
    const clusterName = getCategoryPrinciple(skill.category);

    // Detect weaknesses that appear as recurring themes
    if (skill.weaknesses && skill.weaknesses.length > 0) {
      for (const weakness of skill.weaknesses) {
        // Estimate frequency based on how many sessions we have and category score
        const estimatedFreq = Math.max(1, Math.round(totalSessions * (1 - skill.averageScore / 100)));
        if (estimatedFreq >= 2) {
          patterns.push({
            issue: weakness,
            frequency: Math.min(estimatedFreq, totalSessions),
            totalSessions,
            cluster: clusterName,
            severity: skill.averageScore < 40 ? 'high' : skill.averageScore < 60 ? 'medium' : 'low',
          });
        }
      }
    }

    // Detect declining trends as patterns
    if (typeof skill.trend === 'number' && skill.trend < -3) {
      patterns.push({
        issue: `${skill.category} declining (${skill.trend > 0 ? '+' : ''}${skill.trend} trend)`,
        frequency: totalSessions,
        totalSessions,
        cluster: clusterName,
        severity: skill.trend < -8 ? 'high' : 'medium',
      });
    }

    // Use action points as pattern signals
    if (skill.actionPoints && skill.actionPoints.length > 0) {
      for (const action of skill.actionPoints) {
        patterns.push({
          issue: action,
          frequency: Math.max(2, Math.round(totalSessions * 0.5)),
          totalSessions,
          cluster: clusterName,
          severity: skill.averageScore < 50 ? 'high' : 'medium',
        });
      }
    }
  }

  // Deduplicate by similarity and sort by severity then frequency
  const seen = new Set<string>();
  const unique = patterns.filter(p => {
    const key = p.issue.toLowerCase().slice(0, 40);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const severityOrder = { high: 0, medium: 1, low: 2 };
  return unique
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || b.frequency - a.frequency)
    .slice(0, 5);
}

export function InsightsPanel({ skillCategories, totalCalls, totalRoleplays }: InsightsPanelProps) {
  const totalSessions = totalCalls + totalRoleplays;
  if (totalSessions === 0 || skillCategories.length === 0) return null;

  const patterns = detectPatterns(skillCategories, totalSessions);
  if (patterns.length === 0) return null;

  return (
    <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
      <CardHeader>
        <CardTitle>Pattern Insights</CardTitle>
        <CardDescription>Recurring issues detected across {totalSessions} session{totalSessions !== 1 ? 's' : ''}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {patterns.map((pattern, i) => (
          <div
            key={i}
            className={`rounded-lg border p-4 space-y-2 ${
              pattern.severity === 'high'
                ? 'border-red-500/30 bg-red-500/5'
                : pattern.severity === 'medium'
                  ? 'border-amber-500/30 bg-amber-500/5'
                  : 'border-white/10 bg-white/5'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium leading-relaxed">{pattern.issue}</p>
              <Badge
                className={`flex-shrink-0 text-xs ${
                  pattern.severity === 'high' ? 'bg-red-500/20 text-red-400' :
                  pattern.severity === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}
              >
                {pattern.severity}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <Badge className={`text-xs ${PRINCIPLE_COLORS[pattern.cluster] || 'bg-gray-500/20 text-gray-400'}`}>
                {pattern.cluster}
              </Badge>
              <span>Seen in ~{pattern.frequency}/{pattern.totalSessions} sessions</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
