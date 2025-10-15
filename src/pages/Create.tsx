import { CreatePost } from '@/components/CreatePost';
import { Navbar } from '@/components/Navbar';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const Create = () => {
  return (
    <>
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 pt-20">
        <Link to="/">
          <Button variant="ghost" className="mb-6 hover:bg-secondary">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Home
          </Button>
        </Link>
        <CreatePost />
      </div>
    </>
  );
};

export default Create;
