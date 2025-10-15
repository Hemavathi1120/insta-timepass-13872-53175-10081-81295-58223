import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { Heart, MessageCircle, User as UserIcon, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow';
  fromUserId: string;
  fromUsername?: string;
  fromAvatarUrl?: string;
  postId?: string;
  postImage?: string;
  commentText?: string;
  read: boolean;
  createdAt: any;
}

const Notifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;

    try {
      // Query without orderBy to avoid index requirement
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('toUserId', '==', user.uid)
      );
      
      const notificationsSnapshot = await getDocs(notificationsQuery);
      
      const notificationsData = await Promise.all(
        notificationsSnapshot.docs.map(async (notificationDoc) => {
          const notificationData = notificationDoc.data();
          
          // Fetch user info
          const userDoc = await getDoc(doc(db, 'users', notificationData.fromUserId));
          const userData = userDoc.data();
          
          // Fetch post info if applicable
          let postImage = null;
          if (notificationData.postId) {
            const postDoc = await getDoc(doc(db, 'posts', notificationData.postId));
            if (postDoc.exists()) {
              postImage = postDoc.data().media?.[0];
            }
          }
          
          return {
            id: notificationDoc.id,
            type: notificationData.type,
            fromUserId: notificationData.fromUserId,
            fromUsername: userData?.username || 'Unknown',
            fromAvatarUrl: userData?.avatarUrl,
            postId: notificationData.postId,
            postImage,
            commentText: notificationData.commentText,
            read: notificationData.read || false,
            createdAt: notificationData.createdAt,
          };
        })
      );
      
      // Sort by date on client-side
      notificationsData.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
      
      setNotifications(notificationsData);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        read: true,
      });
      
      setNotifications(notifications.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      ));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like':
        return <Heart className="w-8 h-8 fill-red-500 text-red-500" />;
      case 'comment':
        return <MessageCircle className="w-8 h-8 text-primary" />;
      case 'follow':
        return <UserIcon className="w-8 h-8 text-primary" />;
      default:
        return <Bell className="w-8 h-8 text-primary" />;
    }
  };

  const getNotificationText = (notification: Notification) => {
    switch (notification.type) {
      case 'like':
        return 'liked your post';
      case 'comment':
        return 'commented on your post';
      case 'follow':
        return 'started following you';
      default:
        return 'sent you a notification';
    }
  };

  const getTimeAgo = (timestamp: any) => {
    if (!timestamp?.toDate) return '';
    
    const now = new Date();
    const notificationDate = timestamp.toDate();
    const diffInSeconds = Math.floor((now.getTime() - notificationDate.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return `${Math.floor(diffInSeconds / 604800)}w ago`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <div className="w-16 h-16 rounded-full border-4 border-border border-t-primary animate-spin"></div>
        <p className="text-muted-foreground">Loading notifications...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-20 pb-10">
      <div className="max-w-2xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold gradient-text mb-8">Notifications</h1>

          {notifications.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-20 bg-card border border-border rounded-3xl shadow-lg"
            >
              <div className="w-20 h-20 rounded-full bg-gradient-instagram/10 flex items-center justify-center mx-auto mb-6">
                <Bell className="w-10 h-10 text-primary" />
              </div>
              <p className="text-2xl font-semibold mb-2 text-muted-foreground">No notifications yet</p>
              <p className="text-muted-foreground">When you get notifications, they'll show up here</p>
            </motion.div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification, index) => (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => !notification.read && markAsRead(notification.id)}
                  className={`bg-card border border-border rounded-2xl p-4 hover:shadow-lg transition-all cursor-pointer ${
                    !notification.read ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    {/* User Avatar */}
                    <div className="w-12 h-12 rounded-full bg-gradient-instagram flex items-center justify-center flex-shrink-0">
                      {notification.fromAvatarUrl ? (
                        <img
                          src={notification.fromAvatarUrl}
                          alt={notification.fromUsername}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-white font-bold text-lg">
                          {notification.fromUsername[0]?.toUpperCase()}
                        </span>
                      )}
                    </div>

                    {/* Notification Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-semibold">{notification.fromUsername}</span>
                        {' '}
                        <span className="text-muted-foreground">{getNotificationText(notification)}</span>
                      </p>
                      {notification.commentText && (
                        <p className="text-sm text-muted-foreground mt-1 truncate">
                          "{notification.commentText}"
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {getTimeAgo(notification.createdAt)}
                      </p>
                    </div>

                    {/* Notification Icon */}
                    <div className="flex-shrink-0">
                      {getNotificationIcon(notification.type)}
                    </div>

                    {/* Post Thumbnail */}
                    {notification.postImage && (
                      <Link to={`/`} className="flex-shrink-0">
                        <img
                          src={notification.postImage}
                          alt="Post"
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                      </Link>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Notifications;
