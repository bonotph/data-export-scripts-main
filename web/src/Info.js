import React, { useEffect, useState, useRef } from 'react';
import Sidebar from './Sidebar';
import { useAuth } from './AuthProvider';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import MenuButton from './MenuButton';

export default function Info() {
  const auth = useAuth();
  const [markdownContent, setMarkdownContent] = useState('');
  const contentRef = useRef(null);

  useEffect(() => {
        fetch('/README.md')
      .then((response) => response.text())
      .then((text) => {
        setMarkdownContent(text);
      })
      .catch((error) => {
        console.error('Error fetching the Markdown file:', error);
      });
  }, []);

  return (
    <>
        <Sidebar/>
        <div className = "container  text-center">
        <br/>
        <div class="row justify-content-end">
          <div className='col-1'>
          <MenuButton/>
          </div>
          <div class="col-8">
          <h3 className = "title">User Guide</h3>
          </div>
          <div class="col-3">
      
          <button onClick={() => auth.logOut()} className="logout">Logout</button>
          </div>
        </div>

   <div  style={{ overflowY: 'auto', maxHeight: '100vh' }} ref={contentRef} className="row justify-content-center">
   <br/>
   <div className="card other">
   <div className="card-body">
         <Markdown remarkPlugins={[remarkGfm]}>{markdownContent}</Markdown>
    </div>
    </div>


  </div>
  </div>
    </>
  );
}


