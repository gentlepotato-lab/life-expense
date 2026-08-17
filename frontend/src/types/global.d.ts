declare global {
  interface Window {
    naver: any;
  }

  function alert(message?: any): void;
  function confirm(message?: string): boolean;
}

export {};
