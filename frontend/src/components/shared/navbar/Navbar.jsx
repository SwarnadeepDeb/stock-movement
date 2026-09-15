import { Link } from "react-router";
import UserProfile from "./UserProfile";
import ThemeToggle from "./ThemeToggle";
import SheetMenu from "../sidebar/SheetMenu";

// import { springfieldLogo } from "@/assets"
// import UserProfile from "../UserProfile"

const Navbar = () => {
    return (
        <nav className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-white/60 bg-white/70 shadow-[0_20px_40px_rgba(25,28,30,0.06)] backdrop-blur-xl px-3 sm:px-6 lg:px-8">
            <div className="flex items-center gap-5 lg:gap-8 xl:gap-12">
                <div className="flex items-center gap-2">
                    <SheetMenu />
                    <Link to="/" className="flex items-center gap-2 group">
                        {/* <img src={springfieldLogo} alt="logo" width={28} height={28} /> */}
                        <span className="text-[15px] font-semibold text-[#1E1B4B] tracking-tight">SHAKSHAM'S FASHIONS</span>
                    </Link>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <ThemeToggle />
                <UserProfile />
            </div>
        </nav>
    )
}

export default Navbar
