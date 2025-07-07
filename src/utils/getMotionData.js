export const getMotionData = ({ setError }) => {
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
        setError("test");

        resolve(motionData);
      };

      // Listen for a single motion event
      window.addEventListener("devicemotion", handler, { once: true });
    }
  });
};
