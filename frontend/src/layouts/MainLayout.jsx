import Sidebar from "@/components/shared/sidebar/Sidebar";
import Navbar from "@/components/shared/navbar/Navbar";
import { Outlet } from "react-router";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/app/hooks";

const MainLayout = () => {
  const isOpen = useAppSelector((state) => state.sidebar.isOpen);

  return (
    <>
      <Sidebar />
      <main className={cn(
        "flex h-screen h-dvh flex-col transition-[margin-left] ease-in-out duration-300 premium-bg",
        !isOpen ? "lg:ml-72" : "lg:ml-[90px]"
      )}>
        <Navbar />

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pt-6 pb-6 sm:px-2 lg:px-10">
          <Outlet />
        </div>
      </main>
    </>
  )
}

export default MainLayout
