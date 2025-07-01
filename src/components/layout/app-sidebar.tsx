
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/icons/logo";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { navMenuItems, siteConfig } from "@/config/site";
import type { NavItem } from "@/types";
import React from "react";
import { ChevronDown, ChevronRight }
from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export function AppSidebar() {
  const pathname = usePathname();
  const { state: sidebarState, isMobile, setOpenMobile } = useSidebar();
  const { userProfile } = useAuth();

  const [openSubMenus, setOpenSubMenus] = React.useState<Record<string, boolean>>({});

  const toggleSubMenu = (key: string) => {
    setOpenSubMenus(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const renderNavItems = (items: NavItem[], isSubmenu = false) => {
    return items.map((item) => {
      // Role-based visibility check
      if (item.roles && (!userProfile || !item.roles.includes(userProfile.role))) {
        return null;
      }
      
      // Email-based visibility check
      if (item.allowedEmails && (!userProfile || !item.allowedEmails.includes(userProfile.email))) {
        return null;
      }

      const isActive = item.href === pathname || (item.href !== "/" && pathname.startsWith(item.href || "___NEVER_MATCH_EMPTY_HREF___"));
      const 메뉴버튼Component = isSubmenu ? SidebarMenuSubButton : SidebarMenuButton;
      const 메뉴아이템Component = isSubmenu ? SidebarMenuItem : SidebarMenuItem; 

      const handleItemClick = () => {
        if (isMobile) {
          setOpenMobile(false);
        }
      };
      
      const itemKey = item.title.toLowerCase().replace(/\s+/g, '-');

      if (item.items && item.items.length > 0 && item.collapsible) {
        return (
          <React.Fragment key={itemKey}>
            <메뉴아이템Component>
              <메뉴버튼Component
                onClick={() => toggleSubMenu(itemKey)}
                isActive={isActive}
                tooltip={sidebarState === "collapsed" ? item.title : undefined}
                className="justify-between w-full"
              >
                <>
                  <span className="flex items-center gap-2">
                    {item.icon && <item.icon className="shrink-0" />}
                    <span className={cn(sidebarState === "collapsed" && "hidden")}>{item.title}</span>
                  </span>
                  {sidebarState === "expanded" && (openSubMenus[itemKey] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
                </>
              </메뉴버튼Component>
            </메뉴아이템Component>
            {openSubMenus[itemKey] && sidebarState === "expanded" && (
              <SidebarMenuSub>
                {renderNavItems(item.items, true)}
              </SidebarMenuSub>
            )}
          </React.Fragment>
        );
      }

      return (
        <메뉴아이템Component key={itemKey}>
          <메뉴버튼Component 
            asChild
            isActive={isActive}
            tooltip={sidebarState === "collapsed" ? item.title : undefined}
          >
            <Link href={item.href || "/"} onClick={handleItemClick}>
              <>
                {item.icon && <item.icon className="shrink-0" />}
                <span className={cn(sidebarState === "collapsed" && "hidden")}>{item.title}</span>
                {item.label && sidebarState === "expanded" && (
                  <span className="ml-auto text-xs bg-accent text-accent-foreground px-1.5 py-0.5 rounded-sm">
                    {item.label}
                  </span>
                )}
              </>
            </Link>
          </메뉴버튼Component>
        </메뉴아이템Component>
      );
    });
  };


  return (
    <Sidebar collapsible="icon" variant="sidebar" side="left" className="border-r">
      <SidebarHeader className="p-2 flex items-center justify-between">
        {sidebarState === "expanded" && <Logo />}
        <SidebarTrigger className={cn(sidebarState === "collapsed" && "mx-auto")} />
      </SidebarHeader>
      <ScrollArea className="flex-1">
        <SidebarContent className="p-2">
          <SidebarMenu>
            {renderNavItems(navMenuItems)}
          </SidebarMenu>
        </SidebarContent>
      </ScrollArea>
      <SidebarSeparator />
      <SidebarFooter className="p-2">
        {/* Placeholder for potential footer items or user profile summary */}
      </SidebarFooter>
    </Sidebar>
  );
}
