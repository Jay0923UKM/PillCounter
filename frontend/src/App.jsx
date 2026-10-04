import { useState, useRef } from 'react';
import imageCompression from 'browser-image-compression';

export default function App() {
  const [image, setImage] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [dots, setDots] = useState([]);
  const [status, setStatus] = useState('idle');
  const imageRef = useRef(null);

  const categoryCounts = dots.reduce((acc, dot) => {
    const cat = dot.class || 'Manual Addition';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  const handleImageUpload = async (e) => {
    let file = e.target.files[0];
    if (!file) return;

    setImageFile(file);
    setImage(URL.createObjectURL(file));
    setStatus('analyzing');
    setDots([]);

    const options = {
      maxSizeMB: 0.5,
      maxWidthOrHeight: 1024,
      useWebWorker: true
    };

    try {
      file = await imageCompression(file, options);
    } catch (error) {
      console.error("Compression error:", error);
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      // NOTE: You will change this URL during deployment
      const response = await fetch('http://localhost:8000/predict', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error("Network error");

      const data = await response.json();

      const newDots = data.dots.map((dot, index) => ({
        id: Date.now() + index,
        x: dot.x,
        y: dot.y,
        class: dot.class 
      }));

      setDots(newDots);
      setStatus('done');
    } catch (error) {
      console.error("API Error:", error);
      alert("Failed to connect to the backend server.");
      setStatus('idle');
    }
  };

  const handleImageClick = (e) => {
    if (!imageRef.current || status !== 'done') return;

    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setDots([...dots, { id: Date.now(), x, y, class: 'Manual Addition' }]);
  };

  const removeDot = (e, id) => {
    e.stopPropagation();
    setDots(dots.filter(dot => dot.id !== id));
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans text-slate-800 flex justify-center">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col">

        <div className="bg-slate-900 text-white p-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Pill Counter AI</h1>
            <p className="text-slate-400 text-sm mt-1">Automated Detection & Verification</p>
          </div>
          <div className="bg-emerald-500 text-slate-900 px-6 py-3 rounded-xl text-3xl font-black shadow-inner min-w-[80px] text-center">
            {dots.length}
          </div>
        </div>

        <div className="p-6 md:p-8 flex flex-col gap-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-200">
            <label className="w-full md:w-auto cursor-pointer bg-blue-600 text-white text-center px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition shadow-md">
              Upload or Snap Picture
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageUpload} />
            </label>

            <div className="flex items-center gap-3 font-medium text-slate-600">
              Status: 
              {status === 'idle' && <span className="text-slate-400 bg-slate-200 px-3 py-1 rounded-full text-sm">Waiting for image</span>}
              {status === 'analyzing' && <span className="text-purple-600 bg-purple-100 px-3 py-1 rounded-full text-sm animate-pulse">Roboflow AI counting...</span>}
              {status === 'done' && <span className="text-emerald-600 bg-emerald-100 px-3 py-1 rounded-full text-sm">Count Complete</span>}
            </div>
          </div>

          {status === 'done' && Object.keys(categoryCounts).length > 0 && (
            <div className="flex flex-wrap gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-slate-500 font-semibold text-sm flex items-center mr-2">Breakdown:</span>
              {Object.entries(categoryCounts).map(([cat, count]) => (
                <div key={cat} className="bg-slate-100 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-700 capitalize flex items-center gap-2 border border-slate-200">
                  <span>{cat}</span>
                  <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-xs">{count}</span>
                </div>
              ))}
            </div>
          )}

          {status === 'done' && (
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
              <ul className="list-disc pl-5 space-y-1 text-sm text-blue-900">
                <li>
                  <strong>Missing pill?</strong> Tap image to add.
                </li>
                <li>
                  <strong>Wrong count?</strong> Tap green dot to remove.
                </li>
              </ul>
            </div>
          )}

          <div className="relative w-full bg-slate-200 rounded-xl overflow-hidden min-h-[400px] flex items-center justify-center border-2 border-dashed border-slate-300 shadow-inner">
            {!image && <span className="text-slate-400">No image selected</span>}

            {image && (
              <div className="relative w-full cursor-crosshair leading-none" onClick={handleImageClick}>
                <img ref={imageRef} src={image} alt="Pills" className="w-full h-auto block" />

                {status === 'done' && dots.map((dot) => (
                  <div key={dot.id} onClick={(e) => removeDot(e, dot.id)} className="absolute w-6 h-6 bg-emerald-400 border-2 border-white rounded-full -translate-x-1/2 -translate-y-1/2 cursor-pointer shadow-md hover:bg-red-500 hover:scale-110 transition-all z-20" style={{ top: `${dot.y}%`, left: `${dot.x}%` }} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}