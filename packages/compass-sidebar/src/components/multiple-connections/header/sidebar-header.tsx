import React from 'react';
import {
  Subtitle,
  spacing,
  css,
  type ItemAction,
  ItemActionControls,
} from '@mongodb-js/compass-components';

const sidebarHeaderStyles = css({
  paddingLeft: spacing[400],
  paddingRight: spacing[400],
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
});

const sidebarHeaderTextStyles = css({
  lineHeight: '32px',
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  gap: spacing[200],
});

// MVCompass: inline logo (1.4KB PNG, avoids static file serving)
const MVCOMPASS_LOGO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAFQklEQVR4nO1bT0wcVRj/7bYsULNBqTYxsaIl7UoptNSyqZuuW2KMLZqaNPHAsR4w8dom2hjPSNIeTLxoYjh6sPXAoWpNIQJuAcVgcQubbrfdkCJhG92l5e8urAeY15nZ+fO9NzO7Q+gvIcy+mfne9/vN97735r03wFNsb3hKWVndmYsFddm1bz4BALR3divKU71dJfFtp5PGtQiL3uuUII4IYIW4mU27hbBNACdIm9VjhxheqwaA0pF3ol5LESDiQE0gbFqejQ9y+yAaDcIhRCWvR1jCrU9/QCx3CR2Xo7rXUAUREUFIAAp5PeJqMqmeNOrOvSB0rxZ4ReAWwIy82nkzp7UEsGyTQwQuAYzI8zopgSKASB1UEci9AJV8Nj7IlcR4oLZtlF+oOYokAA95HqR60or/VNgpgqkAFPJOPnU9yOu0IoKhAFTy5YRVEYRGgm4hL4Eigh50BdBTzW3kJZiJoMdHcygsv/jc2Qg+OHWcnbsSncbVm9OK6z/ueBvvtR1lv7+90o+r10fJzlPxxfkONAdeBgB8/uX3GIslFec9AL7qPIZafwgA8OFnX2M2nWHn685cLKi7R+4m0Na0B4/uDLHflb4KtB1v5DUjhL7hGDs+GWwoOv/S+j3U+n0AgMm7DxTk9cAtwG5/JY4d2sd+R1ob8Ex1Ja8ZIQyNxbGaywMAQi0H4KtQBnAkeJAdR++tkGwWCWCUMbOLOQDA6fARVnb6zY3jzPwCqUIJ6r6fMhZYXF7ByF8JAEB1lQ/B5np2bofXixNHAwCA/FoBw/GHmjbU/Lgi4OeBMQBAa1M9nn/Oj3179yDw6osoFIBfohM8poTRN/KkGURanzzxIw2voMa/CwDwx0QCj5fzpF5BIYDZoCGRmkUiNQuv14N3ThxGe6QFADA+dR8zcxk6CwsY+zuJ+cdLAIBgcz1rfvKccEOWK7Qg52kaAZW1exW/rw2MAwBOhZvRttnmftwsKwXya+sY+H0SAFCxcwfLBW+07AcALCyuYPRWgjw24E6Cv45OYml5Fbuf9aO6yofM/AKGx+/wmrEEeTM4GTyI1qZ67KraiIShP6eQy6+RbXELsLSyin6ZA9d/m0B+bZ3XjCVMJWcwM/cfAODwa3V4/63X2bkbN43DXw0mAM/8ntQMCgXgp8FxrgrtgvQQvF4PDu3faKbpf+cRS0wb3cYg8TWMAL32k5yeQ3tnN979qBuzD7N0r21En0ai6x+5jYLsMVLygC3T4ryQ+vxY7hL7k5dT8E86g8nkA0WZlihmYONirSbg1ItPqifNSMvRWHGBPD1GhRGHVG+XpywRoEXeqNxJsMG0tEqrhfZOd7368uC786HNo1DRucbervLkADeBRYB6fR4Qm2GhoONyVPZklOVO1AXo57GyRYCarBPkKXB0g4QesvFB1ATCRaTLMc1mGAFWJhvdAEo3zgQo1Z4ct0Diu+17gacCmF2wVfMAdRivEGC75AE5T1IT2GpRwPMSVyRAqaJA7VypxgDCK0NbJQp4X+EtrQ67DbatDus1A7etCOtBz08tXroRYCaC26LALPT1+Ag1AbeJYGXqzlAAox7BLSJQyBvxMI0AqgilFkJep5X9gqQmQBFBcooH0r28oUvdmkcZ05BzAI8ITkWD2rYdO0XLvle4JhAmXcNj07G9whLs3C2uJYCrd4tLsOt7AWBj7n5LfS8gwY4vRqTpcbkAIv256EucpVlhqVIeIYrJhXTK+XwQhS1TYuWaSLGjXtvWBeTOOPkVmWu/G5RDpGlQbdoNR1eG1E7zCLJd5ifLjv8BHamF/eKivWAAAAAASUVORK5CYII=';

const logoStyles = css({
  width: '24px',
  height: '24px',
});

type Action = 'open-compass-settings';

const actions: ItemAction<Action>[] = [
  {
    action: 'open-compass-settings',
    label: 'Compass Settings',
    icon: 'Settings',
  },
];

export function SidebarHeader({
  onAction,
  isCompassWeb,
}: {
  onAction(actionName: Action): void;
  isCompassWeb?: boolean;
}): React.ReactElement {
  return (
    <div className={sidebarHeaderStyles} data-testid="sidebar-header">
      <Subtitle className={sidebarHeaderTextStyles}>
        <img src={MVCOMPASS_LOGO} alt="MVCompass" className={logoStyles} />
        MVCompass
      </Subtitle>
      {!isCompassWeb && (
        <ItemActionControls<Action>
          onAction={onAction}
          iconSize="small"
          actions={actions}
          data-testid="connections-sidebar-title-actions"
        ></ItemActionControls>
      )}
    </div>
  );
}
