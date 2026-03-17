import React from 'react';
import { ResourceType } from '../../types/enums';

export const RESOURCE_ICON_BASE_PATH = '/assets/icon/32x32/resources';

const RESOURCE_ICON_FILE: Record<ResourceType, string> = {
  [ResourceType.MONEY]: 'Money_Icon.webp',
  [ResourceType.GOLD]: 'Gold_Icon.webp',
  [ResourceType.OIL]: 'Oil_Icon.webp',
  [ResourceType.AMMO]: 'Ammunition_Icon.webp',
  [ResourceType.DIAMOND]: 'Diamond_Icon.webp',
};

export const getResourceIconSrc = (resource: ResourceType) => `${RESOURCE_ICON_BASE_PATH}/${RESOURCE_ICON_FILE[resource]}`;

export const ResourceIcon: React.FC<{ resource: ResourceType; className?: string; alt?: string }> = ({ resource, className = 'w-4 h-4', alt }) => {
  const label = alt || resource;
  return <img src={getResourceIconSrc(resource)} alt={label} className={className} loading="lazy" decoding="async" />;
};
