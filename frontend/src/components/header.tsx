import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { useContext } from "react";
import { ConnectModal } from "@mysten/dapp-kit";
import ConnectMenu from "./ui/connectMenu";
import "@mysten/dapp-kit/dist/index.css";
import { AppContext } from "@/context/AppContext";
import { Link as LinkIcon } from "lucide-react";
import { useRouter } from "next/router";

const Header = () => {
  const { walletAddress, suiName } = useContext(AppContext);
  const router = useRouter();

  return (
    <div
      className="fixed top-0 left-0 w-full backdrop-blur-md"
      style={{
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <header className="w-full max-w-360 mx-auto h-20 flex items-center justify-between pt-5 pb-3 px-4 lg:px-8 z-50 cursor-pointer">
        {/* Logo Link */}
        <span
          className="text-3xl lg:text-4xl font-extrabold bg-clip-text text-transparent bg-[linear-gradient(226deg,#93FE0D_0%,#FFFF00_100%)]"
          style={{ fontFamily: "cursive" }}
          onClick={() => {
            router.push("/");
          }}
        >
          Deceit
        </span>
        {/* Connect Button */}
        {walletAddress ? (
          <ConnectMenu walletAddress={walletAddress} suiName={suiName} />
        ) : (
          <ConnectModal
            trigger={
              <button
                className="h-full rounded-[11px] outline-none ring-0 xl:button-animate-105 overflow-hidden p-[1px]"
                disabled={!!walletAddress}
              >
                <div className="h-full px-5 py-4 flex items-center gap-2 rounded-xl bg-[linear-gradient(226deg,#93FE0D_0%,#FFFF00_100%)]">
                  <span className="text-sm font-semibold">
                    {walletAddress ? "Connected" : "Connect Wallet"}
                  </span>
                  <LinkIcon size={17} />
                </div>
              </button>
            }
          />
        )}
      </header>
    </div>
  );
};

export default Header;
