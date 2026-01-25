'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, AlertTriangle, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

interface Category {
  category: string;
  averageScore: number;
  totalAnalyses: number;
  repCount: number;
}

export default function CategoryAnalysisPage() {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [weakCategories, setWeakCategories] = useState<Category[]>([]);
  const [strongCategories, setStrongCategories] = useState<Category[]>([]);
  const [period, setPeriod] = useState('30');

  useEffect(() => {
    fetchCategories();
  }, [period]);

  const fetchCategories = async () => {
    try {
      const response = await fetch(`/api/manager/categories?days=${period}`);
      if (!response.ok) throw new Error('Failed to fetch categories');
      const data = await response.json();
      setCategories(data.categories || []);
      setWeakCategories(data.weakCategories || []);
      setStrongCategories(data.strongCategories || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-blue-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-500/20 border-green-500/50';
    if (score >= 60) return 'bg-blue-500/20 border-blue-500/50';
    if (score >= 40) return 'bg-orange-500/20 border-orange-500/50';
    return 'bg-red-500/20 border-red-500/50';
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 sm:p-6">
        <div className="text-center py-12">Loading category analysis...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link href="/dashboard/manager">
            <Button variant="ghost" size="sm" className="mb-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold">Category Analysis</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Identify team-wide strengths and weaknesses
          </p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Weak Categories Alert */}
      {weakCategories.length > 0 && (
        <Card className="p-4 sm:p-6 border-red-500/50 bg-red-500/10">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-600 mb-2">Team-Wide Weaknesses</h3>
              <p className="text-sm text-muted-foreground mb-3">
                These categories need immediate attention across the team:
              </p>
              <div className="space-y-2">
                {weakCategories.map((cat, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="font-medium">{cat.category}</span>
                    <Badge variant="destructive">
                      Avg: {cat.averageScore} ({cat.totalAnalyses} analyses)
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Strong Categories */}
      {strongCategories.length > 0 && (
        <Card className="p-6 border-green-500/50 bg-green-500/10">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-green-600 mb-2">Team Strengths</h3>
              <p className="text-sm text-muted-foreground mb-3">
                These are your team's strongest categories:
              </p>
              <div className="space-y-2">
                {strongCategories.map((cat, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="font-medium">{cat.category}</span>
                    <Badge variant="default" className="bg-green-500">
                      Avg: {cat.averageScore} ({cat.totalAnalyses} analyses)
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* All Categories */}
      <div>
        <h2 className="text-lg sm:text-xl font-semibold mb-4">All Categories</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category, idx) => (
            <Card key={idx} className={`p-4 sm:p-6 border-2 ${getScoreBg(category.averageScore)}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">{category.category}</h3>
                <span className={`text-2xl font-bold ${getScoreColor(category.averageScore)}`}>
                  {category.averageScore}
                </span>
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>{category.totalAnalyses} total analyses</p>
                <p>{category.repCount} reps</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
