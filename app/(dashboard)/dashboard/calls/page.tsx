'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, ChevronDown, ChevronRight, Loader2, Trash2 } from 'lucide-react';
import { toastError, toastSuccess } from '@/lib/toast';
import Link from 'next/link';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty';
import { EmptyCallsIllustration } from '@/components/illustrations';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface Call {
  id: string;
  date: string;
  offerName: string;
  prospectName?: string;
  callType: string;
  result: string;
  prospectDifficulty?: number;
  difficultyTier?: string;
  overallScore?: number;
  createdAt: string;
}

export default function CallsPage() {
  const router = useRouter();
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [callTypeFilter, setCallTypeFilter] = useState<string>('all');
  const [resultFilter, setResultFilter] = useState<string>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set()); // First month expanded via useEffect when calls load

  useEffect(() => {
    fetchCalls();
  }, []);

  const fetchCalls = async () => {
    try {
      const response = await fetch('/api/calls');
      if (response.ok) {
        const data = await response.json();
        // Transform the data to match our Call interface
        const transformedCalls = (data.calls || []).map((call: any) => ({
          id: call.id,
          date: call.createdAt || call.date,
          offerName: call.offerName || 'Unknown Offer',
          prospectName: call.prospectName,
          callType: call.callType || 'closing_call',
          result: call.result || 'unknown',
          prospectDifficulty: call.prospectDifficulty,
          difficultyTier: call.difficultyTier,
          overallScore: call.overallScore,
          createdAt: call.createdAt,
        }));
        setCalls(transformedCalls);
      }
    } catch (err) {
      console.error('Error fetching calls:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCall = async (e: React.MouseEvent, callId: string) => {
    e.stopPropagation(); // Prevent row click navigation
    if (!confirm('Are you sure you want to delete this call? This cannot be undone.')) {
      return;
    }
    try {
      const res = await fetch(`/api/calls/${callId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setCalls((prev) => prev.filter((c) => c.id !== callId));
      toastSuccess('Call deleted');
    } catch {
      toastError('Failed to delete call');
    }
  };

  const getCallTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      closing_call: 'Closing Call',
      follow_up: 'Follow-Up',
      no_show: 'No-Show',
    };
    return labels[type] || type;
  };

  const getResultLabel = (result: string) => {
    const labels: Record<string, string> = {
      no_show: 'No-Show',
      closed: 'Closed',
      lost: 'Lost',
      unqualified: 'Unqualified',
      follow_up: 'Follow-Up',
      deposit: 'Deposit',
    };
    return labels[result] || result;
  };

  const getResultBadgeVariant = (result: string) => {
    switch (result) {
      case 'closed':
        return 'default';
      case 'lost':
        return 'destructive';
      case 'deposit':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getDifficultyBadgeVariant = (tier?: string) => {
    switch (tier) {
      case 'easy':
        return 'default';
      case 'realistic':
        return 'secondary';
      case 'hard':
        return 'outline';
      case 'expert':
      case 'elite':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  // Group calls by month
  const groupedCalls = calls.reduce((acc, call) => {
    const date = new Date(call.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    if (!acc[monthKey]) {
      acc[monthKey] = {
        label: monthLabel,
        calls: [],
      };
    }
    acc[monthKey].calls.push(call);
    return acc;
  }, {} as Record<string, { label: string; calls: Call[] }>);

  // Filter calls
  const filteredCalls = calls.filter((call) => {
    const matchesSearch =
      call.offerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (call as any).notes?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCallType = callTypeFilter === 'all' || call.callType === callTypeFilter;
    const matchesResult = resultFilter === 'all' || call.result === resultFilter;
    const matchesDifficulty =
      difficultyFilter === 'all' ||
      call.difficultyTier === difficultyFilter;

    return matchesSearch && matchesCallType && matchesResult && matchesDifficulty;
  });

  // Re-group filtered calls
  const filteredGroupedCalls = filteredCalls.reduce((acc, call) => {
    const date = new Date(call.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    if (!acc[monthKey]) {
      acc[monthKey] = {
        label: monthLabel,
        calls: [],
      };
    }
    acc[monthKey].calls.push(call);
    return acc;
  }, {} as Record<string, { label: string; calls: Call[] }>);

  const toggleMonth = (monthKey: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(monthKey)) {
        next.delete(monthKey);
      } else {
        next.add(monthKey);
      }
      return next;
    });
  };

  // Sort months descending (newest first)
  const sortedMonthKeys = Object.keys(filteredGroupedCalls).sort().reverse();

  // Expand first month by default when calls are loaded (must be after filteredCalls/sortedMonthKeys are defined)
  useEffect(() => {
    if (filteredCalls.length > 0 && expandedMonths.size === 0) {
      const firstMonthKey = sortedMonthKeys[0];
      if (firstMonthKey) {
        setExpandedMonths(new Set([firstMonthKey]));
      }
    }
  }, [filteredCalls.length, expandedMonths.size]);

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="hidden sm:block shrink-0 w-14 h-14 text-muted-foreground/70">
            <EmptyCallsIllustration className="w-full h-full" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Calls</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              View and manage your sales call history
            </p>
          </div>
        </div>
        <Link href="/dashboard/calls/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add New Call
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search calls..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={callTypeFilter} onValueChange={setCallTypeFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Call Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Call Types</SelectItem>
              <SelectItem value="closing_call">Closing Call</SelectItem>
              <SelectItem value="follow_up">Follow-Up</SelectItem>
              <SelectItem value="no_show">No-Show</SelectItem>
            </SelectContent>
          </Select>
          <Select value={resultFilter} onValueChange={setResultFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Result" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Results</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
              <SelectItem value="no_show">No-Show</SelectItem>
              <SelectItem value="unqualified">Unqualified</SelectItem>
              <SelectItem value="deposit">Deposit</SelectItem>
            </SelectContent>
          </Select>
          <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Difficulties</SelectItem>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="realistic">Realistic</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
              <SelectItem value="expert">Expert</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Call History Table */}
      {loading ? (
        <Card className="p-12">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </Card>
      ) : filteredCalls.length === 0 ? (
        <Card className="p-8 sm:p-12">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="illustration" className="size-32">
                <EmptyCallsIllustration className="size-full max-w-[8rem] max-h-[8rem]" />
              </EmptyMedia>
              <EmptyTitle>No calls found</EmptyTitle>
              <EmptyDescription>
                {calls.length === 0
                  ? 'Upload your first call to get started'
                  : 'No calls match your filters'}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              {calls.length === 0 ? (
                <Link href="/dashboard/calls/new">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add New Call
                  </Button>
                </Link>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery('');
                    setCallTypeFilter('all');
                    setResultFilter('all');
                    setDifficultyFilter('all');
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </EmptyContent>
          </Empty>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Offer Name</TableHead>
                  <TableHead>Prospect Name</TableHead>
                  <TableHead>Call Result</TableHead>
                  <TableHead>Prospect Difficulty</TableHead>
                  <TableHead>Overall Score</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedMonthKeys.map((monthKey) => {
                  const monthData = filteredGroupedCalls[monthKey];
                  const isExpanded = expandedMonths.has(monthKey);

                  return (
                    <React.Fragment key={monthKey}>
                      <TableRow
                        className="cursor-pointer hover:bg-accent/50 bg-muted/30"
                        onClick={() => toggleMonth(monthKey)}
                      >
                        <TableCell colSpan={7} className="font-semibold">
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            {monthData.label} ({monthData.calls.length} call{monthData.calls.length !== 1 ? 's' : ''})
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && monthData.calls.map((call) => (
                        <TableRow
                          key={call.id}
                          className="cursor-pointer hover:bg-accent/50"
                          onClick={() => router.push(`/dashboard/calls/${call.id}`)}
                        >
                          <TableCell>
                            {new Date(call.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </TableCell>
                          <TableCell className="font-medium">{call.offerName}</TableCell>
                          <TableCell className="text-muted-foreground">{call.prospectName ?? '—'}</TableCell>
                          <TableCell>
                            <Badge variant={getResultBadgeVariant(call.result)}>
                              {getResultLabel(call.result)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {call.difficultyTier ? (
                              <Badge variant={getDifficultyBadgeVariant(call.difficultyTier)}>
                                {call.difficultyTier === 'elite' ? 'Expert' : call.difficultyTier.charAt(0).toUpperCase() + call.difficultyTier.slice(1)}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {call.overallScore !== null && call.overallScore !== undefined ? (
                              <span className="font-medium">{call.overallScore}/100</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => handleDeleteCall(e, call.id)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
