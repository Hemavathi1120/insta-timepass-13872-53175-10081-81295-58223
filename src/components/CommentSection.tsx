import { useState, useEffect } from 'react';
import { collection, addDoc, query, orderBy, getDocs, doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

interface Comment {
  id: string;
  userId: string;
  text: string;
  createdAt: any;
  username?: string;
  avatarUrl?: string;
}

interface CommentSectionProps {
  postId: string;
  isOpen: boolean;
}

export const CommentSection = ({ postId, isOpen }: CommentSectionProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchComments();
    }
  }, [postId, isOpen]);

  const fetchComments = async () => {
    try {
      const commentsQuery = query(
        collection(db, 'posts', postId, 'comments'),
        orderBy('createdAt', 'asc')
      );
      const commentsSnapshot = await getDocs(commentsQuery);
      
      const commentsData = await Promise.all(
        commentsSnapshot.docs.map(async (commentDoc) => {
          const commentData = commentDoc.data();
          const userDoc = await getDoc(doc(db, 'users', commentData.userId));
          const userData = userDoc.data();
          
          return {
            id: commentDoc.id,
            userId: commentData.userId,
            text: commentData.text,
            createdAt: commentData.createdAt,
            username: userData?.username || 'Anonymous',
            avatarUrl: userData?.avatarUrl,
          };
        })
      );
      
      setComments(commentsData);
    } catch (error: any) {
      console.error('Error fetching comments:', error);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newComment.trim()) return;

    setLoading(true);
    try {
      const commentText = newComment.trim();
      
      await addDoc(collection(db, 'posts', postId, 'comments'), {
        userId: user.uid,
        text: commentText,
        createdAt: new Date(),
      });

      await updateDoc(doc(db, 'posts', postId), {
        commentsCount: increment(1),
      });

      // Get post author to create notification
      const postDoc = await getDoc(doc(db, 'posts', postId));
      const postData = postDoc.data();
      
      // Create notification if not commenting on own post
      if (postData && postData.authorId !== user.uid) {
        await addDoc(collection(db, 'notifications'), {
          type: 'comment',
          toUserId: postData.authorId,
          fromUserId: user.uid,
          postId: postId,
          commentText: commentText,
          read: false,
          createdAt: new Date(),
        });
      }

      setNewComment('');
      await fetchComments();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="border-t border-border overflow-hidden"
      >
        <div className="p-4 space-y-4">
          {/* Comments List */}
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {comments.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">
                No comments yet. Be the first to comment!
              </p>
            ) : (
              comments.map((comment) => (
                <motion.div
                  key={comment.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-start space-x-3"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-instagram flex items-center justify-center flex-shrink-0">
                    {comment.avatarUrl ? (
                      <img
                        src={comment.avatarUrl}
                        alt={comment.username}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-white font-bold text-xs">
                        {comment.username[0]?.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-semibold mr-2">{comment.username}</span>
                      <span className="break-words">{comment.text}</span>
                    </p>
                  </div>
                </motion.div>
              ))
            )}
          </div>

          {/* Add Comment Form */}
          {user && (
            <form onSubmit={handleAddComment} className="flex items-center space-x-2">
              <Input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1"
                disabled={loading}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!newComment.trim() || loading}
                className="flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
