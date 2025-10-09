// components/VoicemailWidget.jsx
import React, { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Button,
  Slide,
  useMediaQuery,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CallIcon from '@mui/icons-material/Call';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';

const TEL_NUMBER = '541-406-0221';
const TEL_HREF = `tel:${TEL_NUMBER.replace(/[^0-9]/g, '')}`;

// Always-on widget: never hidden. We only toggle collapsed vs expanded.
// We optionally remember collapsed state between pages (can remove if you want).
const STORAGE_KEY_COLLAPSED = 'voicemail_widget_collapsed';

export default function VoicemailWidget() {
  const isClient = typeof window !== 'undefined';
  const isMobile = useMediaQuery('(max-width:600px)');

  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    if (!isClient) return;
    setMounted(true);
    // Restore last collapsed state (optional). Remove this block if you prefer no persistence.
    const saved = localStorage.getItem(STORAGE_KEY_COLLAPSED);
    if (saved !== null) setCollapsed(saved === 'true');
  }, [isClient]);

  if (!mounted) return null;

  const handleCall = () => {
    window.location.href = TEL_HREF;
  };

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    if (isClient) localStorage.setItem(STORAGE_KEY_COLLAPSED, String(next));
  };

  const pos = {
    position: 'fixed',
    right: { xs: 12, sm: 16 },
    bottom: { xs: 12, sm: 16 },
    zIndex: (theme) => theme.zIndex.modal + 1,
  };

  return (
    <Box sx={pos} aria-live="polite">
      {/* Collapsed pill (always visible when collapsed) */}
      {collapsed && (
        <Paper
          elevation={3}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.25,
            py: 1,
            borderRadius: 999,
            cursor: 'pointer',
            bgcolor: 'background.paper',
          }}
          onClick={toggleCollapsed}
          aria-label="Open VoicemailBag"
          role="button"
        >
          <ChatBubbleOutlineIcon fontSize="small" />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Leave a voicemail
          </Typography>
        </Paper>
      )}

      {/* Expanded card */}
      <Slide direction="up" in={!collapsed} mountOnEnter unmountOnExit>
        <Paper
          elevation={6}
          sx={{
            width: isMobile ? 300 : 360,
            maxWidth: 'calc(100vw - 24px)',
            borderLeft: (theme) => `6px solid ${theme.palette.primary.main}`,
            p: 2,
            borderRadius: 2,
          }}
          aria-label="VoicemailBag widget"
        >
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, flex: 1 }}>
              VoicemailBag Hotline
            </Typography>
            {/* Close returns to collapsed pill (never hides) */}
            <IconButton
              aria-label="Minimize"
              onClick={toggleCollapsed}
              size="small"
              sx={{ mr: 0.5 }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Leave your stories, comments, news, and questions. Selected messages may air on
            <em> Slabs and Sluffs with Dom and Sara</em> (end of each month).
          </Typography>

          <Button
            onClick={handleCall}
            startIcon={<CallIcon />}
            variant="contained"
            fullWidth
            size={isMobile ? 'medium' : 'large'}
          >
            Call {TEL_NUMBER}
          </Button>

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Standard voice rates apply.
          </Typography>
        </Paper>
      </Slide>
    </Box>
  );
}