
import React from 'react';

const SignalIconn = ({ getClass }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      className="h-[65px] w-auto inline ml-[20px] mt-[-27px]"
    >
      <path className={getClass(1)} d="M40-160v-240h120v240H40Z" />
      <path className={getClass(2)} d="M230-160v-320h120v320H230Z" />
      <path className={getClass(3)} d="M420-160v-440h120v440H420Z" />
      <path className={getClass(4)} d="M610-160v-520h120v520H610Z" />
      <path className={getClass(5)} d="M800-160v-640h120v640H800Z" />
    </svg>
  );
};

export default SignalIconn;
