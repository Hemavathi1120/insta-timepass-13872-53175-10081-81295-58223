import { useState } from 'react';
import { collection, query as firestoreQuery, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Search, User as UserIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { z } from 'zod';

interface User {
  id: string;
  username: string;
  avatarUrl?: string;
  bio?: string;
}

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Input validation schema
const searchSchema = z.string()
  .trim()
  .max(50, 'Search query too long')
  .regex(/^[a-zA-Z0-9_]*$/, 'Only letters, numbers, and underscores allowed');

export const SearchDialog = ({ open, onOpenChange }: SearchDialogProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    // Validate input
    const validation = searchSchema.safeParse(query);
    if (!validation.success) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const sanitizedQuery = validation.data.toLowerCase();
      
      // Search for usernames that start with the query
      const usersQuery = firestoreQuery(
        collection(db, 'users'),
        where('username', '>=', sanitizedQuery),
        where('username', '<=', sanitizedQuery + '\uf8ff'),
        orderBy('username'),
        limit(10)
      );
      
      const usersSnapshot = await getDocs(usersQuery);
      const users = usersSnapshot.docs.map(doc => {
        const data = doc.data() as { username: string; avatarUrl?: string; bio?: string };
        return {
          id: doc.id,
          username: data.username,
          avatarUrl: data.avatarUrl,
          bio: data.bio,
        };
      });
      
      setSearchResults(users);
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    setSearchResults([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl gradient-text">Search Users</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by username..."
              className="pl-10"
              autoFocus
            />
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {searching && (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 rounded-full border-4 border-border border-t-primary animate-spin"></div>
              </div>
            )}

            {!searching && searchQuery && searchResults.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <UserIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No users found</p>
              </div>
            )}

            {!searching && searchResults.length > 0 && (
              <div className="space-y-2">
                {searchResults.map((user, index) => (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Link
                      to={`/profile/${user.id}`}
                      onClick={handleClose}
                      className="flex items-center space-x-3 p-3 rounded-xl hover:bg-accent transition-colors"
                    >
                      <div className="w-12 h-12 rounded-full bg-gradient-instagram flex items-center justify-center flex-shrink-0">
                        {user.avatarUrl ? (
                          <img
                            src={user.avatarUrl}
                            alt={user.username}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-white font-bold text-lg">
                            {user.username[0]?.toUpperCase()}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{user.username}</p>
                        {user.bio && (
                          <p className="text-sm text-muted-foreground truncate">
                            {user.bio}
                          </p>
                        )}
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}

            {!searching && !searchQuery && (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Search for users by username</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
