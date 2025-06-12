'use client';

import React, { useState, useCallback } from 'react';
import {
  Plus,
  Database,
  Globe,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  CreditCard,
  Settings,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getSupabaseOAuth } from '@/lib/supabase/oauth';
import type { 
  CreateProjectRequest, 
  CreateProjectResponse
} from '@/lib/supabase/management';
import type { DatabaseSchema } from '@/types/schema.types';

interface ProjectCreatorProps {
  schema?: DatabaseSchema;
  onProjectCreated?: (project: CreateProjectResponse) => void;
  onCancel?: () => void;
  className?: string;
}

interface RegionOption {
  value: string;
  label: string;
  flag: string;
  description: string;
}

interface PlanOption {
  value: 'free' | 'pro' | 'team' | 'enterprise';
  label: string;
  price: string;
  description: string;
  features: string[];
  icon: React.ReactNode;
  recommended?: boolean;
}

const REGIONS: RegionOption[] = [
  { value: 'us-east-1', label: 'US East (N. Virginia)', flag: '🇺🇸', description: 'Primary US region' },
  { value: 'us-west-1', label: 'US West (N. California)', flag: '🇺🇸', description: 'West coast US' },
  { value: 'eu-west-1', label: 'EU West (Ireland)', flag: '🇪🇺', description: 'Primary EU region' },
  { value: 'eu-central-1', label: 'EU Central (Frankfurt)', flag: '🇪🇺', description: 'Central Europe' },
  { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)', flag: '🇯🇵', description: 'Japan region' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)', flag: '🇸🇬', description: 'Southeast Asia' },
  { value: 'ap-south-1', label: 'Asia Pacific (Mumbai)', flag: '🇮🇳', description: 'India region' },
];

const PLANS: PlanOption[] = [
  {
    value: 'free',
    label: 'Free',
    price: '$0/month',
    description: 'Perfect for hobby projects and learning',
    features: [
      'Up to 2 projects',
      '500MB database',
      '1GB bandwidth',
      '50,000 monthly active users',
      '50MB file storage'
    ],
    icon: <Globe className="h-4 w-4" />,
  },
  {
    value: 'pro',
    label: 'Pro',
    price: '$25/month',
    description: 'Great for production applications',
    features: [
      'Unlimited projects',
      '8GB database',
      '250GB bandwidth',
      '100,000 monthly active users',
      '100GB file storage',
      'Daily backups',
      'Point-in-time recovery'
    ],
    icon: <Zap className="h-4 w-4" />,
    recommended: true,
  },
  {
    value: 'team',
    label: 'Team',
    price: '$599/month',
    description: 'For growing teams and businesses',
    features: [
      'Everything in Pro',
      'No project limit',
      '256GB database',
      '1TB bandwidth',
      '1 million monthly active users',
      '1TB file storage',
      'SOC2 compliance',
      'Priority support'
    ],
    icon: <Settings className="h-4 w-4" />,
  },
];

export function ProjectCreator({
  schema,
  onProjectCreated,
  onCancel,
  className = ''
}: ProjectCreatorProps) {
  const [formData, setFormData] = useState<CreateProjectRequest>({
    name: schema ? `${schema.name} Project` : '',
    organization_id: '',
    plan: 'free',
    region: 'us-east-1',
    kps_enabled: false,
  });

  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string>('');
  const [step, setStep] = useState<'details' | 'plan' | 'region' | 'review'>('details');

  const oauth = getSupabaseOAuth();
  const oauthState = oauth.getState();

  const handleInputChange = useCallback((field: keyof CreateProjectRequest, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  }, []);

  const validateStep = (currentStep: typeof step): boolean => {
    switch (currentStep) {
      case 'details':
        if (!formData.name.trim()) {
          setError('Project name is required');
          return false;
        }
        if (!formData.organization_id) {
          setError('Please select an organization');
          return false;
        }
        break;
      case 'plan':
        if (!formData.plan) {
          setError('Please select a plan');
          return false;
        }
        break;
      case 'region':
        if (!formData.region) {
          setError('Please select a region');
          return false;
        }
        break;
    }
    return true;
  };

  const nextStep = () => {
    if (!validateStep(step)) return;

    const steps = ['details', 'plan', 'region', 'review'] as const;
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    }
  };

  const prevStep = () => {
    const steps = ['details', 'plan', 'region', 'review'] as const;
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    }
  };

  const createProject = async () => {
    if (!validateStep('review') || isCreating) return;

    try {
      setIsCreating(true);
      setError('');

      const managementClient = oauth.getManagementClient();
      const response = await managementClient.createProject(formData);

      onProjectCreated?.(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setIsCreating(false);
    }
  };

  const selectedOrganization = oauthState.organizations?.find(
    org => org.id === formData.organization_id
  );

  const selectedPlan = PLANS.find(plan => plan.value === formData.plan);
  const selectedRegion = REGIONS.find(region => region.value === formData.region);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create New Project
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Badge variant="outline">{step}</Badge>
            {onCancel && (
              <Button variant="ghost" size="sm" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center gap-2 mt-4">
          {['details', 'plan', 'region', 'review'].map((stepName, index) => {
            const steps = ['details', 'plan', 'region', 'review'];
            const currentIndex = steps.indexOf(step);
            const isActive = stepName === step;
            const isCompleted = index < currentIndex;
            
            return (
              <div
                key={stepName}
                className={`
                  flex items-center gap-2
                  ${index > 0 ? 'flex-1' : ''}
                `}
              >
                {index > 0 && (
                  <div className={`
                    flex-1 h-0.5 
                    ${isCompleted ? 'bg-primary' : 'bg-muted'}
                  `} />
                )}
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                  ${isActive ? 'bg-primary text-primary-foreground' : ''}
                  ${isCompleted ? 'bg-green-600 text-white' : ''}
                  ${!isActive && !isCompleted ? 'bg-muted text-muted-foreground' : ''}
                `}>
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Step 1: Project Details */}
        {step === 'details' && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Project Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="My Awesome App"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Choose a descriptive name for your project
              </p>
            </div>

            <div>
              <Label htmlFor="organization">Organization</Label>
              <Select
                value={formData.organization_id}
                onValueChange={(value) => handleInputChange('organization_id', value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select organization..." />
                </SelectTrigger>
                <SelectContent>
                  {oauthState.organizations?.map(org => (
                    <SelectItem key={org.id} value={org.id}>
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        <span>{org.name}</span>
                        <Badge variant="outline" className="ml-auto">
                          {org.members.length} member{org.members.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {schema && (
              <Alert>
                <Database className="h-4 w-4" />
                <AlertDescription>
                  This project will be created with the &quot;{schema.name}&quot; schema containing{' '}
                  {schema.tables.length} table{schema.tables.length !== 1 ? 's' : ''} and{' '}
                  {schema.relationships.length} relationship{schema.relationships.length !== 1 ? 's' : ''}.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Step 2: Plan Selection */}
        {step === 'plan' && (
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-3">Choose a plan</h3>
              <div className="grid gap-4">
                {PLANS.map(plan => (
                  <div
                    key={plan.value}
                    className={`
                      relative p-4 border rounded-lg cursor-pointer transition-colors
                      ${formData.plan === plan.value 
                        ? 'border-primary bg-primary/5 ring-1 ring-primary' 
                        : 'border-border hover:bg-muted/50'
                      }
                      ${plan.recommended ? 'ring-1 ring-blue-200' : ''}
                    `}
                    onClick={() => handleInputChange('plan', plan.value)}
                  >
                    {plan.recommended && (
                      <Badge className="absolute -top-2 left-4 bg-blue-600">
                        Recommended
                      </Badge>
                    )}
                    
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {plan.icon}
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{plan.label}</h4>
                            <Badge variant="outline">{plan.price}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{plan.description}</p>
                        </div>
                      </div>
                      
                      {formData.plan === plan.value && (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-1 text-xs text-muted-foreground">
                      {plan.features.map((feature, index) => (
                        <div key={index} className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                          {feature}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Region Selection */}
        {step === 'region' && (
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-3">Choose a region</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Select the region closest to your users for optimal performance.
              </p>
              
              <div className="grid gap-3">
                {REGIONS.map(region => (
                  <div
                    key={region.value}
                    className={`
                      p-3 border rounded-lg cursor-pointer transition-colors
                      ${formData.region === region.value 
                        ? 'border-primary bg-primary/5 ring-1 ring-primary' 
                        : 'border-border hover:bg-muted/50'
                      }
                    `}
                    onClick={() => handleInputChange('region', region.value)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{region.flag}</span>
                        <div>
                          <div className="font-medium">{region.label}</div>
                          <div className="text-sm text-muted-foreground">{region.description}</div>
                        </div>
                      </div>
                      
                      {formData.region === region.value && (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 'review' && (
          <div className="space-y-4">
            <h3 className="font-medium">Review and Create</h3>
            
            <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Project Name:</span>
                  <p className="font-medium">{formData.name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Organization:</span>
                  <p className="font-medium">{selectedOrganization?.name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Plan:</span>
                  <div className="flex items-center gap-2">
                    {selectedPlan?.icon}
                    <span className="font-medium">{selectedPlan?.label}</span>
                    <Badge variant="outline">{selectedPlan?.price}</Badge>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Region:</span>
                  <div className="flex items-center gap-2">
                    <span>{selectedRegion?.flag}</span>
                    <span className="font-medium">{selectedRegion?.label}</span>
                  </div>
                </div>
              </div>
            </div>

            {schema && (
              <Alert>
                <Database className="h-4 w-4" />
                <AlertDescription>
                  After creation, the &quot;{schema.name}&quot; schema will be automatically deployed to this project.
                </AlertDescription>
              </Alert>
            )}

            <Alert>
              <CreditCard className="h-4 w-4" />
              <AlertDescription>
                {selectedPlan?.value === 'free' 
                  ? 'This project will be created on the free plan with no charges.'
                  : `You will be charged ${selectedPlan?.price} for this project according to Supabase billing terms.`
                }
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={step === 'details'}
          >
            Previous
          </Button>

          <div className="flex items-center gap-2">
            {step !== 'review' ? (
              <Button onClick={nextStep}>
                Next
              </Button>
            ) : (
              <Button
                onClick={createProject}
                disabled={isCreating}
                className="gap-2"
              >
                {isCreating ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Create Project
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}