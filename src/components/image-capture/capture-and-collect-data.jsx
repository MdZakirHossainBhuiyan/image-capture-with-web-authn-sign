import React from "react";

const CaptureAndCollectData = () => {
  const [imageSrc, setImageSrc] = useState(null);
  const [gpsData, setGpsData] = useState(null);
  const [motionData, setMotionData] = useState(null);
  const [error, setError] = useState("");
  const [timeStamp, setTimeStamp] = useState("");
  const inputRef = useRef(null);
  const [imageType, setImageType] = useState("");
  const [deviceInfo, setDeviceInfo] = useState({});
  const [c2paData, setC2paData] = useState(null);
  const [orientation, setOrientation] = useState(null);
  const [sensorStream, setSensorStream] = useState([]);
  const [startCollectingMotionData, setStartCollectingMotionData] =
    useState(false);
  const motionBuffer = useRef([]);
  const intervalRef = useRef(null);

  const [webAuthnCredential, setWebAuthnCredential] = useState(null);

  const [signature, setSignature] = useState(null);
  const [hash, setHash] = useState(null);
  const [pubKey, setPubKey] = useState(null);
  const [assertionKey, setAssertionKey] = useState(null);

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const openCamera = async () => {
    if (!isMobile) {
      setError("Please use a mobile device to capture an image.");
      return;
    }

    setStartCollectingMotionData(true);

    if (inputRef.current) {
      inputRef.current.click();
    }
  };

  const getMotionData = () => {
    return new Promise((resolve, reject) => {
      if (!window.DeviceMotionEvent) {
        return reject(setError("DeviceMotionEvent is not supported"));
      }

      // iOS 13+ requires permission
      if (typeof DeviceMotionEvent.requestPermission === "function") {
        DeviceMotionEvent.requestPermission()
          .then((response) => {
            if (response !== "granted") {
              return reject(setError("Motion permission denied"));
            }

            captureMotion(resolve);
          })
          .catch(reject);
      } else {
        // Android or older iOS
        captureMotion(resolve);
      }

      function captureMotion(resolve) {
        const handler = (event) => {
          window.removeEventListener("devicemotion", handler);

          const motionData = {
            acceleration: event.acceleration,
            accelerationIncludingGravity: event.accelerationIncludingGravity,
            rotationRate: event.rotationRate,
            interval: event.interval,
          };

          resolve(motionData);
        };

        // Listen for a single motion event
        window.addEventListener("devicemotion", handler, { once: true });
      }
    });
  };

  const getDeviceInfo = () => {
    const parser = new UAParser();
    const result = parser.getResult();

    return {
      os: result.os.name + " " + result.os.version,
      deviceType: result.device.type,
      vendor: result.device.vendor,
      model: result.device.model,
      browser: result.browser.name + " " + result.browser.version,
    };
  };

  const getOrientationData = () => {
    return new Promise((resolve, reject) => {
      if (!window.DeviceOrientationEvent) {
        return reject(new Error("DeviceOrientationEvent is not supported"));
      }

      const handleOrientation = (event) => {
        window.removeEventListener("deviceorientation", handleOrientation);

        const { alpha, beta, gamma } = event;

        const orientation = {
          pitch: beta,
          roll: gamma,
          yaw: alpha,
        };

        resolve(orientation);
      };

      window.addEventListener("deviceorientation", handleOrientation, {
        once: true,
      });
    });
  };

  useEffect(() => {
    const info = getDeviceInfo();
    setDeviceInfo(info);
  }, []);

  const registerWebAuthn = async () => {
    const publicKey = {
      challenge: window.crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "Trust chain image capture" },
      user: {
        id: Uint8Array.from("user-id", (c) => c.charCodeAt(0)),
        name: "zakirhossainbhuiyan.office@gmail.com",
        displayName: "Md Zakir Hossain Bhuiyan",
      },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }], // ES256
      authenticatorSelection: { userVerification: "preferred" },
      timeout: 60000,
      attestation: "direct",
    };

    const credential = await navigator.credentials.create({ publicKey });
    return credential;
  };

  const signImageWithWebAuthn = async (file) => {
    if (!webAuthnCredential?.rawId) {
      setError("Missing WebAuthn credential.");
      return;
    }

    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);

    setHash(
      Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
    );

    const publicKey = {
      challenge: new Uint8Array(hashBuffer),
      timeout: 60000,
      allowCredentials: [
        {
          id: new Uint8Array(webAuthnCredential.rawId),
          type: "public-key",
          transports: ["internal"],
        },
      ],
      userVerification: "preferred",
    };

    try {
      const assertion = await navigator.credentials.get({ publicKey });
      setAssertionKey(assertion);

      const signature = new Uint8Array(assertion.response.signature);
      const signatureHex = Array.from(signature)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      setSignature(signatureHex);
      return signatureHex;
    } catch (err) {
      console.error("Signature error:", err);
      setError("WebAuthn signing failed");
      return null;
    }
  };

  const generateC2PAData = async (
    file,
    gpsData,
    motionData,
    orientation,
    timestamp,
    behavioralSensorStream
  ) => {
    const parser = new UAParser();
    const device = parser.getResult();

    const arrayBuffer = await file.arrayBuffer();
    const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);
    const hash = CryptoJS.SHA256(wordArray).toString();
    const randomId = uuidv4();

    const generatedSignature = await signImageWithWebAuthn(file);

    return {
      claimSubmissionId: randomId,
      captureTimestampUtc: timestamp,
      schema: "https://c2pa.org/schema/1.0",
      version: "1.0",
      c2paLikeManifest: {
        c2paAssertions: [
          {
            label: "self.metadata",
            data: {
              timestamp: timestamp,
              gps: {
                latitude: gpsData?.latitude,
                longitude: gpsData?.longitude,
                altitude: gpsData?.altitude,
                accuracyM: gpsData?.accuracy,
                heading: gpsData?.heading,
                speed: gpsData?.speed,
              },
              deviceInfo: {
                model: device.device.model,
                vendor: device.device.vendor,
                type: device.device.type,
                os: device.os.name,
                osVersion: device.os.version,
                browser: device.browser.name,
                browserVersion: device.browser.version,
              },
              orientation: {
                pitch: orientation?.pitch,
                roll: orientation?.roll,
                yaw: orientation?.yaw,
              },
            },
          },
          {
            label: "self.image_hash",
            data: {
              algorithm: "sha256",
              hash: `sha256-${hash}`,
              name: file.name,
              type: file.type,
              size: file.size,
            },
          },
        ],
        c2paSignatureInfo: {
          ussuer: "AntiFraudSDKv0.1",
          signedByHardware: true,
          signature: generatedSignature,
        },
        manifest_version: "0.1",
      },
      behavioralSensorStream: behavioralSensorStream,
    };
  };

  const handleCapture = async (event) => {
    setStartCollectingMotionData(false);
    const file = event.target.files[0];
    if (file) {
      const imageURL = URL.createObjectURL(file);
      setImageSrc(imageURL);

      const mimeType = file.type;
      const imageType = mimeType.split("/")[1].toUpperCase();
      setImageType(imageType);

      // set timestamp data
      const time = new Date();
      setTimeStamp(time.toISOString());

      let coords = null;
      let motion = null;
      let orientation = null;

      try {
        orientation = await getOrientationData();
      } catch (err) {
        console.error("Orientation error:", err.message);
      }

      // set gps data
      try {
        coords = await getLocation();
        setError("");
        setGpsData(coords);
      } catch (error) {
        setError(`Failed to get GPS location: ${error.message}`);
        setGpsData(null);
      }

      // Get motion data
      try {
        motion = await getMotionData();
        setMotionData(motion);
      } catch (err) {
        console.error("Motion error:", err.message);
      }

      const metadata = await generateC2PAData(
        file,
        coords,
        motion,
        orientation,
        time.toISOString(),
        sensorStream
      );
      setC2paData(metadata);
    }
  };

  useEffect(() => {
    const doRegister = async () => {
      try {
        // Step 1: Register WebAuthn before capture (if needed)
        const returnCredential = await registerWebAuthn();
        setWebAuthnCredential(returnCredential);
      } catch (err) {
        console.error("WebAuthn Registration Failed:", err);
        setError("WebAuthn registration failed");
        return;
      }
    };

    if (isMobile) {
      doRegister();
    }
  }, [isMobile, setWebAuthnCredential]);

  useEffect(() => {
    if (startCollectingMotionData) {
      motionBuffer.current = [];

      const handleMotion = (event) => {
        const timestamp = Date.now();

        const accel = event.accelerationIncludingGravity || {};
        const gyro = event.rotationRate || {};

        motionBuffer.current.push({
          timestamp_ms: timestamp,
          gyro_x: gyro.alpha ?? 0,
          gyro_y: gyro.beta ?? 0,
          gyro_z: gyro.gamma ?? 0,
          accel_x: accel.x ?? 0,
          accel_y: accel.y ?? 0,
          accel_z: accel.z ?? 0,
        });

        if (motionBuffer.current.length > 100) {
          motionBuffer.current.shift(); // optional: limit buffer size
        }
      };

      window.addEventListener("devicemotion", handleMotion);

      intervalRef.current = setInterval(() => {
        // Optional live update if needed
        setSensorStream([...motionBuffer.current]);
      }, 500);

      return () => {
        window.removeEventListener("devicemotion", handleMotion);
        clearInterval(intervalRef.current);
      };
    } else {
      // Stop collecting and save the final stream
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      setSensorStream([...motionBuffer.current]);
      motionBuffer.current = [];
    }
  }, [startCollectingMotionData]);

  const downloadC2paData = () => {
    if (!c2paData) return;

    const json = JSON.stringify(c2paData, null, 2); // pretty printed
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "c2pa_data.json";
    a.click();

    URL.revokeObjectURL(url); // Clean up
  };

  return (
    <div className="w-full">
      <div className="w-full flex items-center justify-center">
        <button
          type="button"
          onClick={openCamera}
          className="flex items-center gap-[8px] mt-[24px] md:mt-[50px] px-[12px] md:px-[20px] py-[6px] md:py-[12px] bg-green-400 hover:bg-green-500 cursor-pointer rounded-[8px] text-white"
        >
          <CameraSvgIcon className="w-[18px] md:w-[24px] h-[18px] md:h-[24px]" />
          <span className="text-[14px] md:text-[16px] font-bold">
            Capture Image
          </span>
        </button>
      </div>

      {c2paData && (
        <div className="my-4 flex justify-center">
          <button
            onClick={downloadC2paData}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md"
          >
            Download C2PA JSON
          </button>
        </div>
      )}

      {/* Hidden file input which triggers the camera */}
      <input
        type="file"
        ref={inputRef}
        accept="image/*"
        capture="environment"
        onChange={handleCapture}
        style={{ display: "none" }}
      />

      {/* Display captured image */}
      <div className="my-3">
        {imageSrc && (
          <img
            src={imageSrc}
            alt={`Captured`}
            className="w-full h-[200px] rounded-[12px]"
          />
        )}
      </div>

      {error && <div className="my-3 text-red-400 italic">Error: {error}</div>}

      {/* <div>Signature: {JSON.stringify(signature)}</div>
      <div>Hash: {JSON.stringify(hash)}</div>
      <div>Public Key: {JSON.stringify(pubKey)}</div>
      <div>Assertion: {JSON.stringify(assertionKey)}</div> */}

      {/* {webAuthnCredential ? JSON.stringify(webAuthnCredential?.id) : "hahaha"} */}

      {c2paData && JSON.stringify(c2paData)}

      {c2paData && (
        <div className="w-full flex flex-col gap-[4px]">
          {/* basic data */}
          <div className="w-full flex flex-col bg-gray-50 p-[6px] rounded-[6px]">
            <span className="font-bold text-slate-400 text-[8px]">
              Claim Submission id:
            </span>
            <span className="w-full flex flex-wrap text-slate-500 text-[14px]">
              {c2paData?.claimSubmissionId}
            </span>
          </div>
          <div className="w-full flex flex-col bg-gray-50 p-[6px] rounded-[6px]">
            <span className="font-bold text-slate-400 text-[8px]">
              Clicked time:
            </span>
            <span className="w-full flex flex-wrap text-slate-500 text-[14px]">
              {c2paData?.captureTimestampUtc}
            </span>
          </div>

          {/* gps */}
          <div className="w-full flex flex-col bg-gray-50 p-[6px] rounded-[6px]">
            <span className="font-bold text-slate-400 text-[14px]">GPS:</span>
            <div className="w-full flex flex-wrap gap-[8px]">
              <div className="bg-white p-[4px] rounded-[4px]">
                <span className="font-bold text-slate-400 text-[8px]">
                  Latitude:
                </span>
                <span className="w-full flex flex-wrap text-slate-500 text-[14px]">
                  {
                    c2paData?.c2paLikeManifest?.c2paAssertions[0]?.data?.gps
                      ?.latitude
                  }
                </span>
              </div>
              <div className="bg-white p-[4px] rounded-[4px]">
                <span className="font-bold text-slate-400 text-[8px]">
                  Longitude:
                </span>
                <span className="w-full flex flex-wrap text-slate-500 text-[14px]">
                  {
                    c2paData?.c2paLikeManifest?.c2paAssertions[0]?.data?.gps
                      ?.longitude
                  }
                </span>
              </div>
              <div className="bg-white p-[4px] rounded-[4px]">
                <span className="font-bold text-slate-400 text-[8px]">
                  Altitude:
                </span>
                <span className="w-full flex flex-wrap text-slate-500 text-[14px]">
                  {
                    c2paData?.c2paLikeManifest?.c2paAssertions[0]?.data?.gps
                      ?.altitude
                  }
                </span>
              </div>
              <div className="bg-white p-[4px] rounded-[4px]">
                <span className="font-bold text-slate-400 text-[8px]">
                  Accuracy:
                </span>
                <span className="w-full flex flex-wrap text-slate-500 text-[14px]">
                  {
                    c2paData?.c2paLikeManifest?.c2paAssertions[0]?.data?.gps
                      ?.accuracyM
                  }
                </span>
              </div>
              <div className="bg-white p-[4px] rounded-[4px]">
                <span className="font-bold text-slate-400 text-[8px]">
                  Heading:
                </span>
                <span className="w-full flex flex-wrap text-slate-500 text-[14px]">
                  {
                    c2paData?.c2paLikeManifest?.c2paAssertions[0]?.data?.gps
                      ?.heading
                  }
                </span>
              </div>
              <div className="bg-white p-[4px] rounded-[4px]">
                <span className="font-bold text-slate-400 text-[8px]">
                  Speed:
                </span>
                <span className="w-full flex flex-wrap text-slate-500 text-[14px]">
                  {
                    c2paData?.c2paLikeManifest?.c2paAssertions[0]?.data?.gps
                      ?.speed
                  }
                </span>
              </div>
            </div>
          </div>

          {/* device info */}
          <div className="w-full flex flex-col bg-gray-50 p-[6px] rounded-[6px]">
            <span className="font-bold text-slate-400 text-[14px]">
              Device Info:
            </span>
            <div className="w-full flex flex-wrap gap-[8px]">
              <div className="bg-white p-[4px] rounded-[4px]">
                <span className="font-bold text-slate-400 text-[8px]">
                  Model:
                </span>
                <span className="w-full flex flex-wrap text-slate-500 text-[14px]">
                  {
                    c2paData?.c2paLikeManifest?.c2paAssertions[0]?.data
                      ?.deviceInfo?.model
                  }
                </span>
              </div>
              <div className="bg-white p-[4px] rounded-[4px]">
                <span className="font-bold text-slate-400 text-[8px]">
                  Vendor:
                </span>
                <span className="w-full flex flex-wrap text-slate-500 text-[14px]">
                  {
                    c2paData?.c2paLikeManifest?.c2paAssertions[0]?.data
                      ?.deviceInfo?.vendor
                  }
                </span>
              </div>
              <div className="bg-white p-[4px] rounded-[4px]">
                <span className="font-bold text-slate-400 text-[8px]">
                  Type:
                </span>
                <span className="w-full flex flex-wrap text-slate-500 text-[14px]">
                  {
                    c2paData?.c2paLikeManifest?.c2paAssertions[0]?.data
                      ?.deviceInfo?.type
                  }
                </span>
              </div>
              <div className="bg-white p-[4px] rounded-[4px]">
                <span className="font-bold text-slate-400 text-[8px]">OS:</span>
                <span className="w-full flex flex-wrap text-slate-500 text-[14px]">
                  {
                    c2paData?.c2paLikeManifest?.c2paAssertions[0]?.data
                      ?.deviceInfo?.os
                  }{" "}
                  {
                    c2paData?.c2paLikeManifest?.c2paAssertions[0]?.data
                      ?.deviceInfo?.osVersion
                  }
                </span>
              </div>
              <div className="bg-white p-[4px] rounded-[4px]">
                <span className="font-bold text-slate-400 text-[8px]">
                  Browser:
                </span>
                <span className="w-full flex flex-wrap text-slate-500 text-[14px]">
                  {
                    c2paData?.c2paLikeManifest?.c2paAssertions[0]?.data
                      ?.deviceInfo?.browser
                  }{" "}
                  {
                    c2paData?.c2paLikeManifest?.c2paAssertions[0]?.data
                      ?.deviceInfo?.browserVersion
                  }
                </span>
              </div>
            </div>
          </div>

          {/* orientation */}
          <div className="w-full flex flex-col bg-gray-50 p-[6px] rounded-[6px]">
            <span className="font-bold text-slate-400 text-[14px]">
              Orientation:
            </span>
            <div className="w-full flex flex-wrap gap-[8px]">
              <div className="bg-white p-[4px] rounded-[4px]">
                <span className="font-bold text-slate-400 text-[8px]">
                  Pitch:
                </span>
                <span className="w-full flex flex-wrap text-slate-500 text-[14px]">
                  {
                    c2paData?.c2paLikeManifest?.c2paAssertions[0]?.data
                      ?.orientation?.pitch
                  }
                </span>
              </div>
              <div className="bg-white p-[4px] rounded-[4px]">
                <span className="font-bold text-slate-400 text-[8px]">
                  Roll:
                </span>
                <span className="w-full flex flex-wrap text-slate-500 text-[14px]">
                  {
                    c2paData?.c2paLikeManifest?.c2paAssertions[0]?.data
                      ?.orientation?.roll
                  }
                </span>
              </div>
              <div className="bg-white p-[4px] rounded-[4px]">
                <span className="font-bold text-slate-400 text-[8px]">
                  Yaw:
                </span>
                <span className="w-full flex flex-wrap text-slate-500 text-[14px]">
                  {
                    c2paData?.c2paLikeManifest?.c2paAssertions[0]?.data
                      ?.orientation?.yaw
                  }
                </span>
              </div>
            </div>
          </div>

          {/* Image and hash */}
          <div className="w-full flex flex-col bg-gray-50 p-[6px] rounded-[6px]">
            <span className="font-bold text-slate-400 text-[14px]">
              Image and hash:
            </span>
            <div className="w-full flex flex-wrap gap-[8px]">
              <div className="bg-white p-[4px] rounded-[4px]">
                <span className="font-bold text-slate-400 text-[8px]">
                  Algorithm:
                </span>
                <span className="w-full flex flex-wrap text-slate-500 text-[14px]">
                  {
                    c2paData?.c2paLikeManifest?.c2paAssertions[1]?.data
                      ?.algorithm
                  }
                </span>
              </div>
              <div className="bg-white p-[4px] rounded-[4px]">
                <span className="font-bold text-slate-400 text-[8px]">
                  Hash code:
                </span>
                <span className="w-full flex flex-wrap text-slate-500 text-[14px]">
                  {c2paData?.c2paLikeManifest?.c2paAssertions[1]?.data?.hash}
                </span>
              </div>
              <div className="bg-white p-[4px] rounded-[4px]">
                <span className="font-bold text-slate-400 text-[8px]">
                  File name:
                </span>
                <span className="w-full flex flex-wrap text-slate-500 text-[14px]">
                  {c2paData?.c2paLikeManifest?.c2paAssertions[1]?.data?.name}
                </span>
              </div>
              <div className="bg-white p-[4px] rounded-[4px]">
                <span className="font-bold text-slate-400 text-[8px]">
                  File type:
                </span>
                <span className="w-full flex flex-wrap text-slate-500 text-[14px]">
                  {c2paData?.c2paLikeManifest?.c2paAssertions[1]?.data?.type}
                </span>
              </div>
              <div className="bg-white p-[4px] rounded-[4px]">
                <span className="font-bold text-slate-400 text-[8px]">
                  File size:
                </span>
                <span className="w-full flex flex-wrap text-slate-500 text-[14px]">
                  {c2paData?.c2paLikeManifest?.c2paAssertions[1]?.data?.size}
                </span>
              </div>
            </div>
          </div>

          {/* signature */}
          <div className="w-full flex flex-col bg-gray-50 p-[6px] rounded-[6px]">
            <span className="font-bold text-slate-400 text-[14px]">
              Signature Info:
            </span>
            <div className="w-full flex flex-wrap gap-[8px]">
              <div className="bg-white p-[4px] rounded-[4px]">
                <span className="font-bold text-slate-400 text-[8px]">
                  Ussuer:
                </span>
                <span className="w-full flex flex-wrap text-slate-500 text-[14px]">
                  {c2paData?.c2paLikeManifest?.c2paSignatureInfo?.ussuer}
                </span>
              </div>
              <div className="bg-white p-[4px] rounded-[4px]">
                <span className="font-bold text-slate-400 text-[8px]">
                  Signed by hardware:
                </span>
                <span className="w-full flex flex-wrap text-slate-500 text-[14px]">
                  {c2paData?.c2paLikeManifest?.c2paSignatureInfo
                    ?.signedByHardware
                    ? "True"
                    : "False"}
                </span>
              </div>
              <div className="bg-white p-[4px] rounded-[4px]">
                <span className="font-bold text-slate-400 text-[8px]">
                  Signature:
                </span>
                <span className="w-full flex flex-wrap text-slate-500 text-[14px]">
                  {c2paData?.c2paLikeManifest?.c2paSignatureInfo?.signature}
                </span>
              </div>
            </div>
          </div>

          {/* motion data */}
          <span className="text-slate-400 text-[14px]">Motion Data: </span>
          <div className="w-full flex flex-col bg-gray-50 p-[6px] rounded-[6px]">
            {c2paData?.behavioralSensorStream.map((item, index) => (
              <div key={index}>
                <span className="font-bold text-slate-400 text-[14px]">
                  Record {index + 1}:
                </span>
                <div className="flex flex-wrap gap-[4px]">
                  <div className="bg-white p-[4px] rounded-[4px]">
                    <span className="font-bold text-slate-400 text-[8px]">
                      Time (ms):
                    </span>
                    <span className="w-full flex flex-wrap text-slate-500 text-[14px]">
                      {item?.timestamp_ms}
                    </span>
                  </div>
                  <div className="bg-white p-[4px] rounded-[4px]">
                    <span className="font-bold text-slate-400 text-[8px]">
                      Gyro x:
                    </span>
                    <span className="w-full flex flex-wrap text-slate-500 text-[14px]">
                      {item?.gyro_x}
                    </span>
                  </div>
                  <div className="bg-white p-[4px] rounded-[4px]">
                    <span className="font-bold text-slate-400 text-[8px]">
                      Gyro y:
                    </span>
                    <span className="w-full flex flex-wrap text-slate-500 text-[14px]">
                      {item?.gyro_y}
                    </span>
                  </div>
                  <div className="bg-white p-[4px] rounded-[4px]">
                    <span className="font-bold text-slate-400 text-[8px]">
                      Gyro z:
                    </span>
                    <span className="w-full flex flex-wrap text-slate-500 text-[14px]">
                      {item?.gyro_z}
                    </span>
                  </div>
                  <div className="bg-white p-[4px] rounded-[4px]">
                    <span className="font-bold text-slate-400 text-[8px]">
                      Accel x:
                    </span>
                    <span className="w-full flex flex-wrap text-slate-500 text-[14px]">
                      {item?.accel_x}
                    </span>
                  </div>
                  <div className="bg-white p-[4px] rounded-[4px]">
                    <span className="font-bold text-slate-400 text-[8px]">
                      Accel y:
                    </span>
                    <span className="w-full flex flex-wrap text-slate-500 text-[14px]">
                      {item?.accel_y}
                    </span>
                  </div>
                  <div className="bg-white p-[4px] rounded-[4px]">
                    <span className="font-bold text-slate-400 text-[8px]">
                      Accel z:
                    </span>
                    <span className="w-full flex flex-wrap text-slate-500 text-[14px]">
                      {item?.accel_z}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CaptureAndCollectData;
