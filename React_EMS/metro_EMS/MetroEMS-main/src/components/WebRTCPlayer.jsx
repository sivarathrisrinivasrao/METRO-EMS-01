import { useRef } from "react";

export default function WebRTCPlayer() {
  const videoRef = useRef(null);
  let pcRef = useRef(null);

  async function start() {
    const pc = new RTCPeerConnection();
    pcRef.current = pc;

    // receive-only video
    pc.addTransceiver("video", { direction: "recvonly" });

    pc.ontrack = (event) => {
      videoRef.current.srcObject = event.streams[0];
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Send SDP offer to MediaMTX (WHEP)
    const res = await fetch("http://localhost:8889/quad/whep", {
      method: "POST",
      headers: { "Content-Type": "application/sdp" },
      body: offer.sdp
    });

    if (!res.ok) {
  const errText = await res.text();
  console.error("WHEP error:", errText);
  alert("Stream not available");
  return;
}


  const sdp = await res.text();

  if (!sdp.startsWith("v=")) {
    console.error("Invalid SDP:", sdp);
    return;
  }

  await pc.setRemoteDescription({
    type: "answer",
    sdp
   })
  }

  function stop() {
    pcRef.current?.close();
    pcRef.current = null;
    videoRef.current.srcObject = null;
  }

  return (
    <>
    <div className="flex justify-center">
      {/* <button onClick={start}>Start</button>
      <button onClick={stop}>Stop</button> */}

      <br /><br />

      <video
        ref={videoRef}
        autoPlay
        playsInline
        controls
        style={{ width: "400px", background: "black" ,height: "250px", borderRadius: "8px", border: "2px solid #1e40af" ,justifyContent: "center", alignItems: "center" }}
      />
    </div>

     <div className="flex justify-center gap-4 mt-4">
      <button
        onClick={start}
        className="px-2 py-1 bg-gradient-to-r from-cyan-400 to-blue-600
                   hover:from-cyan-500 hover:to-blue-700
                   text-white text-sm font-semibold rounded-lg
                   shadow-md hover:shadow-lg transition transform hover:-translate-y-0.5"
      >
        Start Stream
      </button>

      <button
        onClick={stop}
        className="px-2 py-1 bg-gradient-to-r from-red-400 to-pink-600
                   hover:from-red-500 hover:to-pink-700
                   text-white text-sm font-semibold rounded-lg
                   shadow-md hover:shadow-lg transition transform hover:-translate-y-0.5"
      >
        Stop Stream
      </button>
    </div>
    </>
  );
}

