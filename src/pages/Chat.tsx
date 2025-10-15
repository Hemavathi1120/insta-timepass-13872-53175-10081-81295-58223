import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { Send, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  createdAt: any;
  read: boolean;
}

interface OtherUser {
  id: string;
  username: string;
  avatarUrl: string;
}

const Chat = () => {
  const { conversationId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || !conversationId) return;

    const loadConversation = async () => {
      try {
        // Get conversation to find other user
        const conversationDoc = await getDoc(doc(db, 'conversations', conversationId));
        if (!conversationDoc.exists()) {
          toast({
            title: "Error",
            description: "Conversation not found",
            variant: "destructive",
          });
          navigate('/messages');
          return;
        }

        const conversationData = conversationDoc.data();
        const otherUserId = conversationData.participants.find((id: string) => id !== user.uid);

        // Get other user's info
        const userDoc = await getDoc(doc(db, 'users', otherUserId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setOtherUser({
            id: otherUserId,
            username: userData.username || 'Unknown',
            avatarUrl: userData.avatarUrl || '',
          });
        }

        setLoading(false);
      } catch (error) {
        console.error('Error loading conversation:', error);
        setLoading(false);
      }
    };

    loadConversation();

    // Listen to messages
    const messagesQuery = query(
      collection(db, 'messages'),
      where('conversationId', '==', conversationId),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(messagesQuery, async (snapshot) => {
      const messagesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Message[];

      setMessages(messagesData);

      // Mark messages as read
      const unreadMessages = messagesData.filter(
        (msg) => msg.receiverId === user.uid && !msg.read
      );

      for (const msg of unreadMessages) {
        await updateDoc(doc(db, 'messages', msg.id), {
          read: true,
        });
      }
    });

    return () => unsubscribe();
  }, [conversationId, user, navigate, toast]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !otherUser || !conversationId) return;

    try {
      // Add message
      await addDoc(collection(db, 'messages'), {
        conversationId,
        senderId: user.uid,
        receiverId: otherUser.id,
        text: newMessage.trim(),
        read: false,
        createdAt: serverTimestamp(),
      });

      // Update conversation
      await setDoc(
        doc(db, 'conversations', conversationId),
        {
          lastMessage: newMessage.trim(),
          lastMessageTime: serverTimestamp(),
        },
        { merge: true }
      );

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <div className="w-16 h-16 rounded-full border-4 border-border border-t-primary animate-spin"></div>
        <p className="text-muted-foreground">Loading chat...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <motion.div
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="sticky top-0 z-50 glass-effect border-b border-border shadow-sm"
      >
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/messages')}
              className="hover:bg-secondary"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>

            {otherUser && (
              <div className="flex items-center space-x-3 flex-1">
                <div className="w-10 h-10 rounded-full bg-gradient-instagram flex items-center justify-center">
                  {otherUser.avatarUrl ? (
                    <img
                      src={otherUser.avatarUrl}
                      alt={otherUser.username}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-white font-bold">
                      {otherUser.username[0]?.toUpperCase()}
                    </span>
                  )}
                </div>
                <p className="font-semibold">{otherUser.username}</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 pb-24">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map((message, index) => {
            const isOwnMessage = message.senderId === user?.uid;
            return (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                    isOwnMessage
                      ? 'bg-gradient-instagram text-white'
                      : 'bg-card border border-border'
                  }`}
                >
                  <p className="text-sm break-words">{message.text}</p>
                </div>
              </motion.div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="fixed bottom-0 left-0 right-0 glass-effect border-t border-border pb-safe">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!newMessage.trim()}
              className="bg-gradient-instagram hover:opacity-90 text-white"
            >
              <Send className="w-5 h-5" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Chat;
