'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, User } from 'lucide-react';
import Link from 'next/link';

interface ProspectAvatar {
  id: string;
  name: string;
  difficultyTier: string;
  difficultyIndex: number;
  authorityLevel: string;
  sourceType: string;
  isTemplate: boolean;
  isActive: boolean;
  createdAt: string;
}

export default function ProspectAvatarsPage() {
  const router = useRouter();
  const [avatars, setAvatars] = useState<ProspectAvatar[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAvatars();
  }, []);

  const fetchAvatars = async () => {
    try {
      const response = await fetch('/api/prospect-avatars');
      if (!response.ok) throw new Error('Failed to fetch avatars');
      const data = await response.json();
      setAvatars(data.avatars || []);
    } catch (error) {
      console.error('Error fetching avatars:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (avatarId: string) => {
    if (!confirm('Are you sure you want to delete this prospect avatar?')) return;

    try {
      const response = await fetch(`/api/prospect-avatars/${avatarId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete avatar');
      
      setAvatars(avatars.filter(a => a.id !== avatarId));
    } catch (error) {
      console.error('Error deleting avatar:', error);
      alert('Failed to delete avatar');
    }
  };

  const getDifficultyColor = (tier: string) => {
    const colors: Record<string, string> = {
      easy: 'bg-green-500/20 text-green-600 border-green-500/50',
      realistic: 'bg-blue-500/20 text-blue-600 border-blue-500/50',
      hard: 'bg-orange-500/20 text-orange-600 border-orange-500/50',
      elite: 'bg-red-500/20 text-red-600 border-red-500/50',
      near_impossible: 'bg-purple-500/20 text-purple-600 border-purple-500/50',
    };
    return colors[tier] || 'bg-gray-500/20 text-gray-600 border-gray-500/50';
  };

  const getAuthorityLabel = (level: string) => {
    const labels: Record<string, string> = {
      advisee: 'Advisee',
      peer: 'Peer',
      advisor: 'Advisor',
    };
    return labels[level] || level;
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 sm:p-6">
        <div className="text-center py-12">Loading avatars...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Prospect Avatars</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Manage prospect profiles for roleplays
          </p>
        </div>
        <Link href="/dashboard/prospect-avatars/new" className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            New Avatar
          </Button>
        </Link>
      </div>

      {/* Avatars List */}
      {avatars.length === 0 ? (
        <Card className="p-8 sm:p-12 text-center">
          <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No prospect avatars yet</h3>
          <p className="text-muted-foreground mb-4">
            Create prospect avatars to use in roleplays, or extract them from call transcripts
          </p>
          <Link href="/dashboard/prospect-avatars/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Avatar
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {avatars.map((avatar) => (
            <Card key={avatar.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-2">{avatar.name}</h3>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <Badge className={getDifficultyColor(avatar.difficultyTier)}>
                      {avatar.difficultyTier.toUpperCase()} ({avatar.difficultyIndex}/40)
                    </Badge>
                    <Badge variant="outline">{getAuthorityLabel(avatar.authorityLevel)}</Badge>
                    {avatar.sourceType === 'transcript_derived' && (
                      <Badge variant="secondary">From Transcript</Badge>
                    )}
                    {avatar.isTemplate && (
                      <Badge variant="default">Template</Badge>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2 pt-4 border-t">
                <Link href={`/dashboard/prospect-avatars/${avatar.id}/edit`} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full">
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(avatar.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
