// Fix react-icons compatibility with CRA's @types/react resolution
import 'react-icons';
import { JSX } from 'react';

declare module 'react-icons/lib' {
  export interface IconBaseProps extends React.SVGAttributes<SVGElement> {
    children?: React.ReactNode;
    size?: string | number;
    color?: string;
    title?: string;
  }
  export type IconType = (props: IconBaseProps) => JSX.Element;
}
