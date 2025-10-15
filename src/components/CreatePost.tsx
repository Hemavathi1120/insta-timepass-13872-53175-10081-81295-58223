import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Upload, X } from 'lucide-react';
import { motion } from 'framer-motion';

declare global {
  interface Window {
    cloudinary: any;
  }
}

export const CreatePost = () => {
  const [caption, setCaption] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleUpload = () => {
    setUploading(true);
    const widget = window.cloudinary.createUploadWidget(
      {
        cloudName: 'dobktsnix',
        uploadPreset: 'Timepass',
        sources: ['local', 'camera'],
        multiple: false,
        maxFiles: 1,
        clientAllowedFormats: ['image', 'video'],
      },
      (error: any, result: any) => {
        if (error) {
          toast({
            title: "Upload failed",
            description: error.message,
            variant: "destructive",
          });
          setUploading(false);
          return;
        }
        
        if (result.event === 'success') {
          setMediaUrl(result.info.secure_url);
          toast({
            title: "Upload successful!",
            description: "Your media has been uploaded.",
          });
        }
        
        if (result.event === 'close') {
          setUploading(false);
        }
      }
    );
    widget.open();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !mediaUrl) return;

    setLoading(true);
    try {
      await addDoc(collection(db, 'posts'), {
        authorId: user.uid,
        media: [mediaUrl],
        caption: caption.trim(),
        likesCount: 0,
        commentsCount: 0,
        createdAt: serverTimestamp(),
        visibility: 'public',
      });

      toast({
        title: "Post created!",
        description: "Your post has been shared successfully.",
      });
      navigate('/');
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

  return (
    <div className="pb-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-2xl mx-auto"
      >
        <h1 className="text-4xl font-bold mb-8 gradient-text">Create New Post</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {!mediaUrl ? (
            <motion.div
              whileHover={{ scale: 1.02 }}
              onClick={handleUpload}
              className="border-2 border-dashed border-border rounded-3xl p-16 text-center cursor-pointer hover:border-primary transition-all bg-card shadow-lg hover:shadow-xl"
            >
              <div className="w-20 h-20 rounded-full bg-gradient-instagram/10 flex items-center justify-center mx-auto mb-6">
                <Upload className="w-10 h-10 text-primary" />
              </div>
              <p className="text-xl font-semibold mb-3">Upload photo or video</p>
              <p className="text-muted-foreground">Click to browse files</p>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative rounded-3xl overflow-hidden bg-card shadow-xl"
            >
              <img
                src={mediaUrl}
                alt="Upload preview"
                className="w-full h-auto max-h-96 object-contain"
              />
              <button
                type="button"
                onClick={() => setMediaUrl('')}
                className="absolute top-4 right-4 glass-effect hover:bg-opacity-80 rounded-full p-3 transition-all shadow-lg"
              >
                <X className="w-6 h-6 text-white" />
              </button>
            </motion.div>
          )}

          <Textarea
            placeholder="Write a caption..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="min-h-32 bg-card border-border resize-none text-base rounded-2xl shadow-md focus:shadow-lg transition-shadow"
          />

          <Button
            type="submit"
            disabled={!mediaUrl || loading}
            className="w-full bg-gradient-instagram hover:opacity-90 text-white font-semibold h-12 text-base shadow-lg hover:shadow-xl transition-all"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
            ) : (
              'Share Post'
            )}
          </Button>
        </form>
      </motion.div>

      {/* Load Cloudinary widget */}
      <script src="https://widget.cloudinary.com/v2.0/global/all.js" type="text/javascript"></script>
    </div>
  );
};
