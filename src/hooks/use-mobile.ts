   // Description: Simple hook to detect if the screen size is mobile.

   'use client';

   import { useState, useEffect } from 'react';

   const MOBILE_BREAKPOINT = 768; // md breakpoint (Tailwind default)

   /**
    * Custom hook to determine if the current viewport width is considered mobile.
    * @returns {boolean} True if the viewport width is less than the mobile breakpoint, false otherwise.
    */
   export function useIsMobile(): boolean {
       // Initialize state, default to false on SSR to avoid layout shifts
       const [isMobile, setIsMobile] = useState(false);

       useEffect(() => {
           // Check only runs on the client-side
           if (typeof window === 'undefined') {
               return;
           }

           const checkDevice = () => {
               setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
           };

           // Initial check on mount
           checkDevice();

           // Add resize listener
           window.addEventListener('resize', checkDevice);

           // Cleanup listener on unmount
           return () => {
               window.removeEventListener('resize', checkDevice);
           };
       }, []); // Empty dependency array ensures this runs only once on mount and cleans up on unmount

       return isMobile;
   }