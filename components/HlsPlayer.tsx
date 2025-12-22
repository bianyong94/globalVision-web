import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';

interface Props {
  src: string;
  poster?: string;
}

const HlsPlayer: React.FC<Props> = ({ src, poster }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Check for native HLS support (Safari, generic mobile)
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
    } else if (Hls.isSupported()) {
      // Use Hls.js for Chrome/Firefox/Edge
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
      
      const hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
      hlsRef.current = hls;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, [src]);

  return (
    <div className="w-full aspect-video bg-black relative">
      <video
        ref={videoRef}
        poster={poster}
        controls
        playsInline
        className="w-full h-full"
      />
    </div>
  );
};

export default HlsPlayer;