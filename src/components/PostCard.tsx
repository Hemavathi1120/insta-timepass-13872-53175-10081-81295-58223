import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, increment, collection, addDoc, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Send } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { CommentSection } from '@/components/CommentSection';

interface Post {
  id: string;
  authorId: string;
  media: string[];
  caption: string;
  likesCount: number;
  commentsCount: number;
  createdAt: any;
}

interface Author {
  username: string;
  avatarUrl: string;
}

export const PostCard = ({ post }: { post: Post }) => {
  const [author, setAuthor] = useState<Author | null>(null);
  const [liked, setLiked] = useState(false);
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const fetchAuthor = async () => {
      const authorDoc = await getDoc(doc(db, 'users', post.authorId));
      if (authorDoc.exists()) {
        setAuthor(authorDoc.data() as Author);
      }
    };

    const checkLiked = async () => {
      if (!user) return;
      const likesQuery = query(
        collection(db, 'posts', post.id, 'likes'),
        where('userId', '==', user.uid)
      );
      const likesSnapshot = await getDocs(likesQuery);
      setLiked(!likesSnapshot.empty);
    };

    fetchAuthor();
    checkLiked();
  }, [post.id, post.authorId, user]);

  const handleLike = async () => {
    if (!user) return;

    try {
      const likesRef = collection(db, 'posts', post.id, 'likes');
      const likesQuery = query(likesRef, where('userId', '==', user.uid));
      const likesSnapshot = await getDocs(likesQuery);

      if (likesSnapshot.empty) {
        // Add like
        await addDoc(likesRef, { userId: user.uid, createdAt: new Date() });
        await updateDoc(doc(db, 'posts', post.id), {
          likesCount: increment(1),
        });
        setLiked(true);

        // Create notification if not liking own post
        if (post.authorId !== user.uid) {
          await addDoc(collection(db, 'notifications'), {
            type: 'like',
            toUserId: post.authorId,
            fromUserId: user.uid,
            postId: post.id,
            read: false,
            createdAt: new Date(),
          });
        }
      } else {
        // Remove like
        const likeDoc = likesSnapshot.docs[0];
        await deleteDoc(doc(db, 'posts', post.id, 'likes', likeDoc.id));
        await updateDoc(doc(db, 'posts', post.id), {
          likesCount: increment(-1),
        });
        setLiked(false);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDoubleClick = async () => {
    if (!user) return;

    // Show heart animation
    setShowHeartAnimation(true);
    setTimeout(() => setShowHeartAnimation(false), 1000);

    // Add like if not already liked
    if (!liked) {
      await handleLike();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3 }}
      className="bg-card border border-border rounded-3xl overflow-hidden mb-6 shadow-lg hover:shadow-xl"
      style={{ boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)' }}
    >
      {/* Post Header */}
      <div className="flex items-center p-4 space-x-3">
        <div className="w-11 h-11 rounded-full bg-gradient-instagram flex items-center justify-center shadow-md">
          {author?.avatarUrl ? (
            <img src={author.avatarUrl} alt={author.username} className="w-full h-full rounded-full object-cover" />
          ) : (
            <span className="text-white font-bold text-lg">{author?.username?.[0]?.toUpperCase()}</span>
          )}
        </div>
        <span className="font-semibold text-base">{author?.username || 'Loading...'}</span>
      </div>

      {/* Post Image */}
      <div 
        className="relative aspect-square bg-secondary cursor-pointer select-none"
        onDoubleClick={handleDoubleClick}
      >
        <img
          src={post.media[0]}
          alt="Post"
          className="w-full h-full object-cover"
        />
        
        {/* Double-click heart animation */}
        {showHeartAnimation && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1.2, opacity: 1 }}
            exit={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <Heart className="w-24 h-24 fill-white text-white drop-shadow-lg" />
          </motion.div>
        )}
      </div>

      {/* Post Actions */}
      <div className="p-4 space-y-3">
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLike}
            className="hover:bg-transparent hover:scale-110 transition-transform"
          >
            <Heart 
              className={`w-7 h-7 transition-all ${
                liked ? 'fill-red-500 text-red-500' : 'hover:text-muted-foreground'
              }`} 
            />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setShowComments(!showComments)}
            className="hover:bg-transparent hover:scale-110 transition-transform"
          >
            <MessageCircle className={`w-7 h-7 hover:text-muted-foreground ${showComments ? 'fill-primary text-primary' : ''}`} />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="hover:bg-transparent hover:scale-110 transition-transform"
          >
            <Send className="w-7 h-7 hover:text-muted-foreground" />
          </Button>
        </div>

        <div>
          <p className="font-semibold mb-1">{post.likesCount} likes</p>
          {post.caption && (
            <p>
              <span className="font-semibold mr-2">{author?.username}</span>
              {post.caption}
            </p>
          )}
          {post.commentsCount > 0 && !showComments && (
            <button
              onClick={() => setShowComments(true)}
              className="text-muted-foreground text-sm mt-1 hover:text-foreground transition-colors"
            >
              View all {post.commentsCount} comments
            </button>
          )}
        </div>
      </div>

      {/* Comment Section */}
      <CommentSection postId={post.id} isOpen={showComments} />
    </motion.div>
  );
};
