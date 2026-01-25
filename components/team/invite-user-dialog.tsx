'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Search, UserPlus, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface User {
  id: string;
  name: string;
  email: string;
  profilePhoto?: string | null;
}

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function InviteUserDialog({
  open,
  onOpenChange,
  onSuccess,
}: InviteUserDialogProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'rep' | 'manager' | 'admin'>('rep');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  const debouncedEmail = useDebounce(email, 500);

  // Search for users when email changes
  useEffect(() => {
    if (debouncedEmail.length < 2) {
      setSearchResults([]);
      setSelectedUser(null);
      return;
    }

    setIsSearching(true);
    setError(null);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/team/invite?q=${encodeURIComponent(debouncedEmail)}`);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to search users');
        }

        const data = await response.json();
        setSearchResults(data.users || []);

        // Show message if user exists but can't be invited
        if (data.message) {
          setError(data.message);
        } else if (data.users && data.users.length > 0) {
          setError(null);
        }
      } catch (err: any) {
        console.error('Error searching users:', err);
        setError(err.message || 'Failed to search users');
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [debouncedEmail]);

  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    setEmail(user.email);
    setSearchResults([]);
  };

  const handleInvite = async () => {
    if (!selectedUser) {
      setError('Please select a user from the search results');
      return;
    }

    setIsInviting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: selectedUser.email,
          role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to invite user');
      }

      setSuccess(data.message || 'User invited successfully!');

      // Reset form and close after a delay
      setTimeout(() => {
        setEmail('');
        setSelectedUser(null);
        setSearchResults([]);
        setRole('rep');
        setSuccess(null);
        onOpenChange(false);
        onSuccess();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to invite user');
    } finally {
      setIsInviting(false);
    }
  };

  const handleClose = () => {
    if (!isInviting) {
      setEmail('');
      setSelectedUser(null);
      setSearchResults([]);
      setError(null);
      setSuccess(null);
      setRole('rep');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-serif">Invite Team Member</DialogTitle>
          <DialogDescription>
            Search for and invite a registered user to join your team. Only users who have already signed up can be invited.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Email Search */}
          <div className="space-y-2">
            <Label htmlFor="email">Search by Email</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="Enter user's email address..."
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setSelectedUser(null);
                }}
                className="pl-9"
                disabled={isInviting}
              />
            </div>
            {isSearching && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Searching for users...
              </div>
            )}
          </div>

          {/* Search Results */}
          {!isSearching && searchResults.length > 0 && !selectedUser && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Select a user:
              </Label>
              <div className="border border-white/10 rounded-lg bg-card/50 backdrop-blur-sm max-h-48 overflow-y-auto">
                {searchResults.map((user) => {
                  const initials = user.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2);

                  return (
                    <button
                      key={user.id}
                      onClick={() => handleSelectUser(user)}
                      className="w-full p-3 text-left hover:bg-accent/50 transition-colors border-b border-white/5 last:border-0 flex items-center gap-3"
                    >
                      <Avatar className="h-8 w-8 ring-2 ring-primary/20 shrink-0">
                        <AvatarImage src={user.profilePhoto || undefined} alt={user.name} />
                        <AvatarFallback className="bg-linear-to-br from-primary to-primary/80 text-primary-foreground text-xs font-medium">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{user.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Selected User */}
          {selectedUser && (
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 ring-2 ring-primary/20 shrink-0">
                  <AvatarImage src={selectedUser.profilePhoto || undefined} alt={selectedUser.name} />
                  <AvatarFallback className="bg-linear-to-br from-primary to-primary/80 text-primary-foreground text-sm font-medium">
                    {selectedUser.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{selectedUser.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{selectedUser.email}</div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedUser(null);
                    setEmail('');
                  }}
                  disabled={isInviting}
                >
                  Change
                </Button>
              </div>
            </div>
          )}

          {/* No Results */}
          {!isSearching && debouncedEmail.length >= 2 && searchResults.length === 0 && !selectedUser && !error && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No available users found with that email. Make sure the user has signed up first and is not already in an organization.
              </AlertDescription>
            </Alert>
          )}

          {/* Role Selection */}
          {selectedUser && (
            <div className="space-y-2">
              <Label htmlFor="role">Assign Role</Label>
              <Select value={role} onValueChange={(value: any) => setRole(value)} disabled={isInviting}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rep">Rep</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success Message */}
          {success && (
            <Alert className="border-emerald-500/50 bg-emerald-500/10">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <AlertDescription className="text-emerald-500">{success}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isInviting}>
            Cancel
          </Button>
          <Button
            onClick={handleInvite}
            disabled={!selectedUser || isInviting}
          >
            {isInviting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Inviting...
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite User
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
