"use client";

import { useState } from "react";
import UpgradePlanModal from "@/components/UpgradePlanModal";

interface Props {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export default function AccountUpgradeButton({ className, style, children }: Props) {
  const [showModal, setShowModal] = useState(false);
  return (
    <>
      {showModal && <UpgradePlanModal onClose={() => setShowModal(false)} />}
      <button
        onClick={() => setShowModal(true)}
        className={className}
        style={style}
      >
        {children}
      </button>
    </>
  );
}
