/**
 * @title Rate Limit Indicator Component
 * @dev Componente para mostrar status de rate limiting na UI
 * @author Blocktrust Team
 */

import React, { useState, useEffect } from 'react';
import { DeterministicWalletGenerator, RateLimitStatus, RateLimitConfig } from '../services/wallet-generator';

interface RateLimitIndicatorProps {
  identifier?: string;
  config?: RateLimitConfig;
  className?: string;
  onRateLimitChange?: (status: RateLimitStatus) => void;
}

export const RateLimitIndicator: React.FC<RateLimitIndicatorProps> = ({
  identifier = 'default',
  config,
  className = '',
  onRateLimitChange
}) => {
  const [status, setStatus] = useState<RateLimitStatus>({
    isLimited: false,
    attemptsRemaining: 5,
    nextAttemptAllowedAt: 0
  });
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  const updateStatus = () => {
    const newStatus = DeterministicWalletGenerator.checkRateLimit(identifier, config);
    setStatus(newStatus);
    
    if (newStatus.isLimited) {
      const remaining = Math.max(0, newStatus.nextAttemptAllowedAt - Date.now());
      setTimeRemaining(remaining);
    } else {
      setTimeRemaining(0);
    }

    if (onRateLimitChange) {
      onRateLimitChange(newStatus);
    }
  };

  useEffect(() => {
    updateStatus();
    
    // Atualiza status a cada segundo quando limitado
    const interval = setInterval(() => {
      updateStatus();
    }, 1000);

    return () => clearInterval(interval);
  }, [identifier, config]);

  const formatTime = (milliseconds: number): string => {
    const seconds = Math.ceil(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${remainingSeconds}s`;
  };

  const getStatusColor = (): string => {
    if (status.isLimited) {
      return status.cooldownEndsAt ? 'text-red-600 bg-red-50' : 'text-yellow-600 bg-yellow-50';
    }
    if (status.attemptsRemaining <= 2) {
      return 'text-orange-600 bg-orange-50';
    }
    return 'text-green-600 bg-green-50';
  };

  const getStatusIcon = (): string => {
    if (status.isLimited) {
      return status.cooldownEndsAt ? '🚫' : '⏰';
    }
    if (status.attemptsRemaining <= 2) {
      return '⚠️';
    }
    return '✅';
  };

  const getStatusMessage = (): string => {
    if (status.isLimited) {
      if (status.cooldownEndsAt) {
        return `Bloqueado temporariamente. Aguarde ${formatTime(timeRemaining)}.`;
      }
      return `Limite atingido. Próxima tentativa em ${formatTime(timeRemaining)}.`;
    }
    return `${status.attemptsRemaining} tentativas restantes.`;
  };

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${getStatusColor()} ${className}`}>
      <span className="text-lg">{getStatusIcon()}</span>
      <div className="flex flex-col">
        <span className="text-sm font-medium">
          Rate Limiting
        </span>
        <span className="text-xs">
          {getStatusMessage()}
        </span>
      </div>
    </div>
  );
};

export default RateLimitIndicator;
