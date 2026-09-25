import React from 'react';
import {Composition} from 'remotion';
import {Promo45, Poster} from './Promo45';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
export const Root=()=> <><Composition id="Promo45" component={Promo45} durationInFrames={1350} fps={30} width={1920} height={1080}/><Composition id="PromoPoster" component={Poster} durationInFrames={1} fps={30} width={1920} height={1080}/></>;
