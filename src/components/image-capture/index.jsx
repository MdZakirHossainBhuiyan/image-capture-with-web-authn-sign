import React, { useState } from "react";
import logo from "../../assets/logo_croped.png";
import CaptureAndCollectData from "./capture-and-collect-data";

const ImageCaptureIndex = () => {
  const [isCapturedImage, setIsCapturedImage] = useState(false);

  return (
    <div className="w-full md:w-[30%] h-auto md:min-h-[80%] bg-white rounded-[8px] md:rounded-[16px] p-[12px] md:p-[24px] flex flex-col items-center justify-between">
      {isCapturedImage ? (
        <div>
          <div className="w-full flex items-start gap-[16px]">
            <div>
              <img src={logo} alt="logo" className="w-[50px] h-[50px]" />
            </div>
            <div>
              <h2 className="text-[14px] font-medium text-slate-500">
                Secure & Signed Image Collection
              </h2>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full flex flex-col items-center gap-[16px] mt-[24px] md:mt-[50px]">
          <img
            src={logo}
            alt="logo"
            className="w-[80px] md:w-[150px] h-[80px] md:h-[150px]"
          />
          <h2 className="text-[16px] md:text-[24px] font-medium text-slate-500 mt-[16px] md:mt-[24px]">
            Secure & Signed Image Collection
          </h2>

          <CaptureAndCollectData setIsCapturedImage={setIsCapturedImage} />

          <p className="text-[14px] md:text-[16px] text-center text-slate-400 mt-[16px] md:mt-[24px]">
            Capture images with location and sensor data. Each image is securely
            hashed and signed for authenticity.
          </p>
        </div>
      )}

      <div className="mt-[40px] md:mt-[40px]">
        <h4 className="italic text-[14px] text-slate-400">
          Developed by: Md Zakir Hossain Bhuiyan
        </h4>
      </div>
    </div>
  );
};

export default ImageCaptureIndex;
