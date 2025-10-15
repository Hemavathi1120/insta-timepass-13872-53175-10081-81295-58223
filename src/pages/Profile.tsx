import { useEffect, useState, useRef } from 'react';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { Grid, Edit, Upload, UserPlus, UserMinus, Settings, LogOut, Moon, Sun } from 'lucide-react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { PostManagement } from '@/components/PostManagement';
import { useTheme } from 'next-themes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface UserProfile {
  username: string;
  bio: string;
  avatarUrl: string;
  followers: string[];
  following: string[];
}

interface Post {
  id: string;
  media: string[];
}

const Profile = () => {
  const { userId } = useParams<{ userId?: string }>();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determine which user's profile to show
  const profileUserId = userId || user?.uid;
  const isOwnProfile = !userId || userId === user?.uid;

  const fetchProfile = async () => {
    if (!profileUserId) return;

    try {
      const userDoc = await getDoc(doc(db, 'users', profileUserId));
      if (userDoc.exists()) {
        const profileData = userDoc.data() as UserProfile;
        setProfile(profileData);
        
        // Check if current user is following this profile
        if (user && !isOwnProfile) {
          setIsFollowing(profileData.followers?.includes(user.uid) || false);
        }
      }

      const postsQuery = query(
        collection(db, 'posts'),
        where('authorId', '==', profileUserId)
      );
      const postsSnapshot = await getDocs(postsQuery);
      const postsData = postsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Post[];
      setPosts(postsData);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [profileUserId]);

  const handleEditClick = () => {
    if (profile) {
      setEditUsername(profile.username);
      setEditBio(profile.bio || '');
      setEditAvatarUrl(profile.avatarUrl || '');
      setPreviewUrl(profile.avatarUrl || null);
      setEditDialogOpen(true);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Image must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const storage = getStorage();
      const fileExtension = file.name.split('.').pop();
      const fileName = `${user.uid}_${Date.now()}.${fileExtension}`;
      const storageRef = ref(storage, `avatars/${fileName}`);

      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      setEditAvatarUrl(downloadURL);
      setPreviewUrl(downloadURL);

      toast({
        title: "Image uploaded!",
        description: "Your profile picture has been uploaded successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        username: editUsername.trim(),
        bio: editBio.trim(),
        avatarUrl: editAvatarUrl.trim(),
      });

      setProfile({
        ...profile!,
        username: editUsername.trim(),
        bio: editBio.trim(),
        avatarUrl: editAvatarUrl.trim(),
      });

      toast({
        title: "Profile updated!",
        description: "Your profile has been updated successfully.",
      });

      setEditDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!user || !profileUserId || isOwnProfile) return;

    setFollowLoading(true);
    try {
      const currentUserRef = doc(db, 'users', user.uid);
      const profileUserRef = doc(db, 'users', profileUserId);

      if (isFollowing) {
        // Unfollow
        await updateDoc(currentUserRef, {
          following: arrayRemove(profileUserId)
        });
        await updateDoc(profileUserRef, {
          followers: arrayRemove(user.uid)
        });

        setProfile(prev => prev ? {
          ...prev,
          followers: prev.followers?.filter(id => id !== user.uid) || []
        } : null);

        toast({
          title: "Unfollowed",
          description: `You unfollowed ${profile?.username}`,
        });
      } else {
        // Follow
        await updateDoc(currentUserRef, {
          following: arrayUnion(profileUserId)
        });
        await updateDoc(profileUserRef, {
          followers: arrayUnion(user.uid)
        });

        setProfile(prev => prev ? {
          ...prev,
          followers: [...(prev.followers || []), user.uid]
        } : null);

        toast({
          title: "Following",
          description: `You are now following ${profile?.username}`,
        });
      }

      setIsFollowing(!isFollowing);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setFollowLoading(false);
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <div className="w-16 h-16 rounded-full border-4 border-border border-t-primary animate-spin"></div>
        <p className="text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-20 pb-10">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <Link to="/">
            <Button variant="ghost" className="hover:bg-secondary">
              <span className="sr-only">Back to Home</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
              Back to Home
            </Button>
          </Link>
          
          {isOwnProfile && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="hover:bg-secondary">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Settings</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={toggleTheme} className="cursor-pointer">
                  {theme === 'dark' ? (
                    <>
                      <Sun className="w-4 h-4 mr-2" />
                      <span>Light Mode</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-4 h-4 mr-2" />
                      <span>Dark Mode</span>
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          {/* Profile Header */}
          <div className="flex items-start space-x-8 mb-8 bg-card border border-border rounded-3xl p-8 shadow-lg">
            <div className="w-32 h-32 rounded-full bg-gradient-instagram flex items-center justify-center flex-shrink-0 shadow-xl">
              {profile?.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.username}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="text-5xl text-white font-bold">
                  {profile?.username?.[0]?.toUpperCase()}
                </span>
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-4xl font-bold gradient-text">{profile?.username}</h1>
                {isOwnProfile ? (
                  <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleEditClick}
                        className="hover:bg-secondary"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Profile
                      </Button>
                    </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-bold gradient-text">Edit Profile</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      {/* Profile Picture Preview & Upload */}
                      <div className="space-y-2">
                        <Label>Profile Picture</Label>
                        <div className="flex items-center space-x-4">
                          <div className="w-20 h-20 rounded-full bg-gradient-instagram flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {previewUrl ? (
                              <img
                                src={previewUrl}
                                alt="Preview"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-2xl text-white font-bold">
                                {editUsername?.[0]?.toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 space-y-2">
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              onChange={handleFileSelect}
                              className="hidden"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={uploading}
                              className="w-full"
                            >
                              {uploading ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-primary mr-2"></div>
                                  Uploading...
                                </>
                              ) : (
                                <>
                                  <Upload className="w-4 h-4 mr-2" />
                                  Upload Image
                                </>
                              )}
                            </Button>
                            <p className="text-xs text-muted-foreground">
                              Max 5MB • JPG, PNG, GIF
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          value={editUsername}
                          onChange={(e) => setEditUsername(e.target.value)}
                          placeholder="Enter username"
                          className="bg-secondary border-border"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="bio">Bio</Label>
                        <Textarea
                          id="bio"
                          value={editBio}
                          onChange={(e) => setEditBio(e.target.value)}
                          placeholder="Tell us about yourself"
                          className="bg-secondary border-border resize-none min-h-24"
                        />
                      </div>
                      <Button 
                        onClick={handleSaveProfile} 
                        disabled={saving || !editUsername.trim()}
                        className="w-full bg-gradient-instagram hover:opacity-90 text-white"
                      >
                        {saving ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                        ) : (
                          'Save Changes'
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                ) : (
                  <Button 
                    variant={isFollowing ? "outline" : "default"}
                    size="sm" 
                    onClick={handleFollowToggle}
                    disabled={followLoading}
                    className={isFollowing ? "hover:bg-secondary" : "bg-gradient-instagram hover:opacity-90 text-white"}
                  >
                    {followLoading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-current mr-2"></div>
                    ) : isFollowing ? (
                      <>
                        <UserMinus className="w-4 h-4 mr-2" />
                        Unfollow
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Follow
                      </>
                    )}
                  </Button>
                )}
              </div>
              <div className="flex space-x-12 mb-6">
                <div className="text-center">
                  <p className="text-2xl font-bold">{posts.length}</p>
                  <p className="text-muted-foreground text-sm">posts</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{profile?.followers?.length || 0}</p>
                  <p className="text-muted-foreground text-sm">followers</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{profile?.following?.length || 0}</p>
                  <p className="text-muted-foreground text-sm">following</p>
                </div>
              </div>
              {profile?.bio && <p className="text-foreground/90 text-lg">{profile.bio}</p>}
            </div>
          </div>

          {/* Posts Grid */}
          <div className="pt-8">
            <div className="flex items-center justify-center mb-8 space-x-2">
              <Grid className="w-6 h-6 text-primary" />
              <span className="font-bold text-xl">POSTS</span>
            </div>

            {posts.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-20 bg-card border border-border rounded-3xl shadow-lg"
              >
                <div className="w-20 h-20 rounded-full bg-gradient-instagram/10 flex items-center justify-center mx-auto mb-6">
                  <Grid className="w-10 h-10 text-primary" />
                </div>
                <p className="text-2xl font-semibold mb-2 text-muted-foreground">No posts yet</p>
                <p className="text-muted-foreground">Share your first moment!</p>
              </motion.div>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                {posts.map((post, index) => (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ scale: 1.05, y: -4 }}
                    className="aspect-square bg-secondary rounded-2xl overflow-hidden cursor-pointer shadow-md hover:shadow-xl transition-shadow relative group"
                  >
                    <img
                      src={post.media[0]}
                      alt="Post"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <PostManagement
                      post={post}
                      onPostUpdated={fetchProfile}
                      onPostDeleted={fetchProfile}
                      isOwnPost={isOwnProfile}
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Profile;
