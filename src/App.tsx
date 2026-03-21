import { useState } from "react";
export default function App() {
const [count, setCount] = useState(0);
return (

<div className="min-h-screen flex items-center justify-center"> <div className="max-w-md w-full p-6 bg-white rounded-xl shadow"> <h1 className="text-2xl font-semibold mb-2">Atlas Crest</h1> <p className="text-gray-600 mb-6">Control UI starter</p> <button onClick={() => setCount((c) => c + 1)} className="px-4 py-2 rounded bg-black text-white hover:bg-gray-800" > Clicks: {count} </button> </div> </div> ); }
